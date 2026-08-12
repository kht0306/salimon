package com.salimon.notificationlistener

import android.app.Activity
import android.app.Instrumentation
import android.content.Context
import android.os.Bundle
import java.io.File

class NotificationCaptureInstrumentation : Instrumentation() {
  override fun onCreate(arguments: Bundle?) {
    super.onCreate(arguments)
    start()
  }

  override fun onStart() {
    try {
      verifyEncryptedStorageLifecycle()
      finish(Activity.RESULT_OK, Bundle())
    } catch (error: Throwable) {
      finish(
        Activity.RESULT_CANCELED,
        Bundle().apply {
          putString("failureType", error::class.java.simpleName)
        },
      )
      throw error
    }
  }

  private fun verifyEncryptedStorageLifecycle() {
    val context = targetContext.applicationContext
    val store = EncryptedNotificationStore(context)
    val sessionFingerprint = NotificationCaptureIdentity
      .sessionFingerprint("instrumentation-user")
    val now = System.currentTimeMillis()
    val notificationText = NotificationText(
      title = "테스트 카드",
      text = "승인 12,000원",
      expandedText = "민감번호 1234567812345678",
    )

    store.clearAll()
    check(PaymentNotificationFilter.shouldStore(notificationText))
    check(
      store.capture(
        sourcePackageName = "com.example.card",
        notificationKey = "notification-key",
        receivedAt = now,
        text = notificationText,
        sessionFingerprint = sessionFingerprint,
        capturedAt = now,
      ),
    )
    check(
      !store.capture(
        sourcePackageName = "com.example.card",
        notificationKey = "notification-key",
        receivedAt = now,
        text = notificationText,
        sessionFingerprint = sessionFingerprint,
        capturedAt = now,
      ),
    )

    val records = store.readRecords(sessionFingerprint, now)
    check(records.size == 1)
    check(!records.single().expandedText.contains("1234567812345678"))
    check(records.single().expandedText.contains("[민감번호 숨김]"))
    checkEncryptedFilesDoNotContainPlaintext(context)

    store.capture(
      sourcePackageName = "com.example.card",
      notificationKey = "expired-notification-key",
      receivedAt = now - NOTIFICATION_RETENTION_MILLIS - 1,
      text = notificationText,
      sessionFingerprint = sessionFingerprint,
      capturedAt = now,
    )
    check(store.deleteExpiredRecords(now) == 1)
    check(store.countRecords(now) == 1)

    check(store.readRecords("another-session", now).isEmpty())
    check(store.countRecords(now) == 0)
    store.clearAll()
  }

  private fun checkEncryptedFilesDoNotContainPlaintext(context: Context) {
    val directory = File(
      context.noBackupFilesDir,
      "salimon_notification_records",
    )
    val storedText = directory
      .listFiles()
      .orEmpty()
      .joinToString(separator = "") { file -> file.readText() }

    check(!storedText.contains("테스트 카드"))
    check(!storedText.contains("승인 12,000원"))
    check(!storedText.contains("1234567812345678"))
  }
}
