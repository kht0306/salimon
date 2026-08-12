package com.salimon.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class SalimonNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(statusBarNotification: StatusBarNotification?) {
    val postedNotification = statusBarNotification ?: return
    val packageName = postedNotification.packageName ?: return
    if (packageName == applicationContext.packageName) return
    if (!NotificationAccessState.hasAccess(applicationContext)) return

    val preferences = NotificationCapturePreferences(applicationContext).snapshot()
    if (
      !preferences.isCaptureActive ||
      packageName !in preferences.allowedPackageNames
    ) {
      return
    }

    val notification = postedNotification.notification ?: return
    if (shouldIgnore(notification)) return

    val text = extractNotificationText(notification)
    if (!PaymentNotificationFilter.shouldStore(text)) return

    try {
      EncryptedNotificationStore(applicationContext).capture(
        sourcePackageName = packageName,
        notificationKey = postedNotification.key,
        receivedAt = postedNotification.postTime,
        text = text,
        sessionFingerprint = preferences.sessionFingerprint,
      )
    } catch (_: Exception) {
      // 원문이나 암호화 오류 내용을 로그로 남기지 않는다.
    }
  }

  private fun shouldIgnore(notification: Notification): Boolean {
    val ignoredFlags = Notification.FLAG_GROUP_SUMMARY or
      Notification.FLAG_ONGOING_EVENT
    val hasIgnoredFlag = notification.flags and ignoredFlags != 0
    val isProgressNotification =
      notification.category == Notification.CATEGORY_PROGRESS ||
        notification.extras.getInt(Notification.EXTRA_PROGRESS_MAX, 0) > 0
    return hasIgnoredFlag || isProgressNotification
  }

  private fun extractNotificationText(notification: Notification): NotificationText {
    val extras = notification.extras
    val lines = extras
      .getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.joinToString("\n") { line -> line.toString() }
      .orEmpty()
    val expandedText = extras
      .getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?.toString()
      ?.ifBlank { lines }
      ?: lines

    return NotificationText(
      title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty(),
      text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty(),
      expandedText = expandedText,
    )
  }
}
