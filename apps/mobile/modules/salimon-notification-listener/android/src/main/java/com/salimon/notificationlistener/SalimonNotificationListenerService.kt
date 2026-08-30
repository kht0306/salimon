package com.salimon.notificationlistener

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
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
      val stored = EncryptedNotificationStore(applicationContext).capture(
        sourcePackageName = packageName,
        notificationKey = postedNotification.key,
        receivedAt = postedNotification.postTime,
        text = text,
        sessionFingerprint = preferences.sessionFingerprint,
      )
      if (stored && preferences.reviewNotificationsEnabled) {
        showCandidateReviewNotification()
      }
    } catch (_: Exception) {
      // 원문이나 암호화 오류 내용을 로그로 남기지 않는다.
    }
  }

  private fun shouldIgnore(notification: Notification): Boolean {
    val hasIgnoredFlag =
      notification.flags and Notification.FLAG_ONGOING_EVENT != 0
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

  private fun showCandidateReviewNotification() {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as
      NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          REVIEW_CHANNEL_ID,
          "결제 알림 후보",
          NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
          description = "새 결제 알림 후보가 저장되었을 때 알려줍니다."
        },
      )
    }

    val contentIntent = PendingIntent.getActivity(
      this,
      0,
      Intent(Intent.ACTION_VIEW, Uri.parse("salimon://inbox"))
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, REVIEW_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    builder
      .setSmallIcon(R.drawable.ic_salimon_notification)
      .setContentTitle("확인할 결제 알림이 있어요")
      .setContentText("살림온 후보함에서 검토해 주세요.")
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_REMINDER)
      .setContentIntent(contentIntent)

    manager.notify(REVIEW_NOTIFICATION_ID, builder.build())
  }

  companion object {
    private const val REVIEW_CHANNEL_ID = "salimon_candidate_review"
    private const val REVIEW_NOTIFICATION_ID = 9001
  }
}
