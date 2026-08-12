package com.salimon.notificationlistener

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class EncryptedNotificationStore(context: Context) {
  private val storageDirectory = File(
    context.noBackupFilesDir,
    STORAGE_DIRECTORY_NAME,
  )

  @Synchronized
  fun capture(
    sourcePackageName: String,
    notificationKey: String,
    receivedAt: Long,
    text: NotificationText,
    sessionFingerprint: String,
    capturedAt: Long = System.currentTimeMillis(),
  ): Boolean {
    deleteExpiredRecords(capturedAt)

    val sanitizedText = SensitiveNotificationTextSanitizer.sanitize(text)
    val recordId = NotificationCaptureIdentity.recordId(
      packageName = sourcePackageName,
      notificationKey = notificationKey,
      receivedAt = receivedAt,
      text = sanitizedText,
    )
    val encryptionKey = getOrCreateKey()
    val targetFile = recordFile(recordId)
    if (targetFile.exists()) return false

    ensureStorageDirectory()
    val record = NotificationCaptureRecord(
      id = recordId,
      sourcePackageName = sourcePackageName,
      receivedAt = receivedAt,
      capturedAt = capturedAt,
      title = sanitizedText.title,
      text = sanitizedText.text,
      expandedText = sanitizedText.expandedText,
    )
    val plaintext = recordToJson(record, sessionFingerprint)
      .toString()
      .toByteArray(Charsets.UTF_8)
    val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, encryptionKey)
    cipher.updateAAD(recordId.toByteArray(Charsets.UTF_8))
    val ciphertext = cipher.doFinal(plaintext)
    val envelope = JSONObject()
      .put("version", STORAGE_VERSION)
      .put("id", recordId)
      .put("sourcePackageName", sourcePackageName)
      .put("receivedAt", receivedAt)
      .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))

    writeEnvelope(targetFile, envelope)
    return true
  }

  @Synchronized
  fun readRecords(
    expectedSessionFingerprint: String,
    now: Long = System.currentTimeMillis(),
  ): List<NotificationCaptureRecord> {
    deleteExpiredRecords(now)
    val files = recordFiles()
    if (files.isEmpty()) return emptyList()

    val key = try {
      getExistingKey()
    } catch (_: Exception) {
      null
    }
    if (key == null) {
      deleteRecordFiles()
      return emptyList()
    }

    return files.mapNotNull { file ->
      readRecord(file, key, expectedSessionFingerprint)
    }.sortedByDescending(NotificationCaptureRecord::receivedAt)
  }

  @Synchronized
  fun deleteRecord(recordId: String): Boolean {
    if (!RECORD_ID_PATTERN.matches(recordId)) return false
    return recordFile(recordId).delete()
  }

  @Synchronized
  fun deleteExpiredRecords(now: Long = System.currentTimeMillis()): Int {
    val expiresBefore = now - NOTIFICATION_RETENTION_MILLIS
    var deletedCount = 0

    recordFiles().forEach { file ->
      val receivedAt = readEnvelope(file)?.optLong("receivedAt", Long.MIN_VALUE)
      if (receivedAt == null || receivedAt < expiresBefore) {
        if (file.delete()) deletedCount += 1
      }
    }

    return deletedCount
  }

  @Synchronized
  fun countRecords(now: Long = System.currentTimeMillis()): Int {
    deleteExpiredRecords(now)
    return recordFiles().size
  }

  @Synchronized
  fun clearAll() {
    deleteRecordFiles()
    try {
      deleteKeyIfPresent()
    } catch (_: Exception) {
      // 레코드는 이미 삭제되었으므로 복호화 가능한 원문은 남지 않는다.
    }
  }

  private fun readRecord(
    file: File,
    key: SecretKey,
    expectedSessionFingerprint: String,
  ): NotificationCaptureRecord? {
    return try {
      val envelope = readEnvelope(file) ?: return discard(file)
      val id = envelope.getString("id")
      if (
        envelope.getInt("version") != STORAGE_VERSION ||
        !RECORD_ID_PATTERN.matches(id) ||
        file.name != "$id$RECORD_FILE_SUFFIX"
      ) {
        return discard(file)
      }

      val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
      cipher.init(
        Cipher.DECRYPT_MODE,
        key,
        GCMParameterSpec(
          GCM_TAG_LENGTH_BITS,
          Base64.decode(envelope.getString("iv"), Base64.NO_WRAP),
        ),
      )
      cipher.updateAAD(id.toByteArray(Charsets.UTF_8))
      val plaintext = cipher.doFinal(
        Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP),
      )
      val payload = JSONObject(String(plaintext, Charsets.UTF_8))

      if (
        payload.getString("sessionFingerprint") !=
        expectedSessionFingerprint
      ) {
        return discard(file)
      }

      NotificationCaptureRecord(
        id = payload.getString("id"),
        sourcePackageName = payload.getString("sourcePackageName"),
        receivedAt = payload.getLong("receivedAt"),
        capturedAt = payload.getLong("capturedAt"),
        title = payload.optString("title"),
        text = payload.optString("text"),
        expandedText = payload.optString("expandedText"),
      )
    } catch (_: Exception) {
      discard(file)
    }
  }

  private fun recordToJson(
    record: NotificationCaptureRecord,
    sessionFingerprint: String,
  ): JSONObject = JSONObject()
    .put("id", record.id)
    .put("sessionFingerprint", sessionFingerprint)
    .put("sourcePackageName", record.sourcePackageName)
    .put("receivedAt", record.receivedAt)
    .put("capturedAt", record.capturedAt)
    .put("title", record.title)
    .put("text", record.text)
    .put("expandedText", record.expandedText)

  private fun readEnvelope(file: File): JSONObject? = try {
    val bytes = AtomicFile(file).openRead().use { input -> input.readBytes() }
    JSONObject(String(bytes, Charsets.UTF_8))
  } catch (_: Exception) {
    null
  }

  private fun writeEnvelope(file: File, envelope: JSONObject) {
    val atomicFile = AtomicFile(file)
    val output = atomicFile.startWrite()
    try {
      output.write(envelope.toString().toByteArray(Charsets.UTF_8))
      atomicFile.finishWrite(output)
    } catch (error: Exception) {
      atomicFile.failWrite(output)
      throw error
    }
  }

  private fun getOrCreateKey(): SecretKey {
    try {
      getExistingKey()?.let { key -> return key }
    } catch (_: Exception) {
      deleteRecordFiles()
      try {
        deleteKeyIfPresent()
      } catch (_: Exception) {
        // 새 키 생성이 실패하면 호출자에게 전달하고 평문 저장으로 우회하지 않는다.
      }
    }

    if (recordFiles().isNotEmpty()) {
      deleteRecordFiles()
    }

    return KeyGenerator
      .getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
      .apply {
        init(
          KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
          )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(AES_KEY_SIZE_BITS)
            .setRandomizedEncryptionRequired(true)
            .build(),
        )
      }
      .generateKey()
  }

  private fun getExistingKey(): SecretKey? = loadKeyStore()
    .getKey(KEY_ALIAS, null) as? SecretKey

  private fun loadKeyStore(): KeyStore = KeyStore
    .getInstance(ANDROID_KEY_STORE)
    .apply { load(null) }

  private fun deleteKeyIfPresent() {
    val keyStore = loadKeyStore()
    if (keyStore.containsAlias(KEY_ALIAS)) {
      keyStore.deleteEntry(KEY_ALIAS)
    }
  }

  private fun ensureStorageDirectory() {
    check(storageDirectory.isDirectory || storageDirectory.mkdirs()) {
      "알림 원문 저장소를 준비하지 못했습니다."
    }
  }

  private fun recordFiles(): List<File> = storageDirectory
    .listFiles { file ->
      file.isFile && file.name.endsWith(RECORD_FILE_SUFFIX)
    }
    ?.toList()
    .orEmpty()

  private fun recordFile(recordId: String): File = File(
    storageDirectory,
    "$recordId$RECORD_FILE_SUFFIX",
  )

  private fun deleteRecordFiles() {
    recordFiles().forEach(File::delete)
  }

  private fun discard(file: File): Nothing? {
    file.delete()
    return null
  }

  companion object {
    private const val STORAGE_DIRECTORY_NAME = "salimon_notification_records"
    private const val RECORD_FILE_SUFFIX = ".capture"
    private const val STORAGE_VERSION = 1
    private const val ANDROID_KEY_STORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "salimon_notification_capture_aes_v1"
    private const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
    private const val AES_KEY_SIZE_BITS = 256
    private const val GCM_TAG_LENGTH_BITS = 128
    private val RECORD_ID_PATTERN = Regex("[0-9a-f]{64}")
  }
}
