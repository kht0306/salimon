package com.salimon.notificationlistener

import android.app.Activity
import android.app.Instrumentation
import android.app.Notification
import android.app.Person
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
      verifyMessageExtraction()
      verifyEncryptedStorageLifecycle()
      finish(Activity.RESULT_OK, Bundle().apply {
        putString("checksPassed", "disclosure,message-extraction,encrypted-storage")
      })
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

  private fun verifyMessageExtraction() {
    val context = targetContext.applicationContext
    val kb = "[Web발신] KB국민카드1234 승인 26,700 원(일시불) 테스트몰 고객명 테*트님 승인시각 09/23 18:15 누적 500,000원"
    val woori = "[우리카드 이용 안내] 우리(5678)승인 테*트님 220,000원 일시불 07/20 09:58 (주)테스트교육"
    val sender = Person.Builder().setName("우리카드").build()
    val style = Notification.MessagingStyle(Person.Builder().setName("나").build())
      .addMessage(woori, 1_789_900_000_000, sender)
      .addMessage("10,000원 결제했어요", 1_789_900_001_000, Person.Builder().setName("친구").build())
      .addMessage(woori.replace("승인", "승인취소"), 1_789_900_002_000, sender)
    val notification = Notification.Builder(context, "test")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setStyle(style)
      .build()
    val messages = NotificationTextExtractor.extract(notification, "com.kakao.talk", "notification-1", 1_789_900_003_000)
    check(messages.size == 3)
    check(messages.count { PaymentNotificationFilter.shouldStore(it.text, "com.kakao.talk") } == 1)
    check(messages.first().text.title == "우리카드")
    check(messages.first().receivedAt == 1_789_900_000_000)
    val repeated = NotificationTextExtractor.extract(notification, "com.kakao.talk", "notification-2", 1_789_900_009_000)
    check(messages == repeated)

    notification.flags = notification.flags or Notification.FLAG_GROUP_SUMMARY
    check(NotificationTextExtractor.extract(notification, "com.kakao.talk", "summary", 1L).isEmpty())

    for (source in listOf("com.samsung.android.messaging", "com.google.android.apps.messaging")) {
      val sms = Notification.Builder(context, "test")
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle("KB국민카드")
        .setContentText("새 메시지")
        .setStyle(Notification.BigTextStyle().bigText(kb))
        .build()
      val message = NotificationTextExtractor.extract(sms, source, "sms", 1L).single()
      check(message.text.expandedText == kb)
      check(PaymentNotificationFilter.shouldStore(message.text, source))
      check(!PaymentNotificationFilter.shouldStore(message.text.copy(expandedText = kb.replace("승인 ", "승인취소 ")), source))
      check(!PaymentNotificationFilter.shouldStore(message.text.copy(expandedText = "$kb\n$kb"), source))
      check(!PaymentNotificationFilter.shouldStore(NotificationText("친구", "결제 10,000원", ""), source))
      check(!PaymentNotificationFilter.shouldStore(NotificationText("KB국민카드", "[Web발신] 취소 [KB국민카드] 1234 09/20 이용건 09/22 부분취소(-15,900원)", ""), source))
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
      PaymentNotificationFilter.shouldStore(
        NotificationText(
          title = "오늘의집",
          text = "59,900원 승인",
          expandedText = "쇼핑엔 로카(8*3*)\n일시불, 08/28 14:15\n누적금액 2,710,755원",
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
