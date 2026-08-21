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
      verifyDisclosureGating()
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

  private fun verifyDisclosureGating() {
    val context = targetContext.applicationContext
    val preferences = NotificationCapturePreferences(context)
    preferences.clearSession()

    check(
      runCatching { preferences.acceptDisclosure() }.isFailure,
    )
    preferences.setAuthenticatedUser("instrumentation-user")
    check(!preferences.snapshot().hasDisclosureConsent)

    preferences.acceptDisclosure(1_786_547_200_000)
    preferences.configureCollection(
      enabled = true,
      allowedPackageNames = listOf("com.example.card"),
      ownPackageName = context.packageName,
      targetLedgerId = "ledger-1",
      reviewNotificationsEnabled = false,
    )
    check(preferences.snapshot().isCaptureActive)

    preferences.revokeDisclosure()
    check(!preferences.snapshot().hasDisclosureConsent)
    check(!preferences.snapshot().isCaptureActive)
    preferences.clearSession()
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
      PaymentNotificationFilter.shouldStore(
        NotificationText(
          title = "해외 승인 테스트",
          text = "USD 7.24 해외승인",
          expandedText = "",
        ),
      ),
    )
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
    check(
      store.saveRegistrationState(
        recordId = records.single().id,
        expectedSessionFingerprint = sessionFingerprint,
        registrationState = NotificationRegistrationState(
          amount = 12_000,
          categoryId = "category-1",
          merchantName = "암호화 테스트상점",
          paymentMethodId = "card-1",
          targetLedgerId = "ledger-1",
          transactionAt = "2026-08-13T14:00:00+09:00",
          updatedAt = now,
        ),
      ),
    )
    val pendingRecord = store.readRecords(sessionFingerprint, now).single()
    check(pendingRecord.registrationState?.amount == 12_000L)
    check(pendingRecord.registrationState?.categoryId == "category-1")
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
    check(!storedText.contains("암호화 테스트상점"))
  }
}
