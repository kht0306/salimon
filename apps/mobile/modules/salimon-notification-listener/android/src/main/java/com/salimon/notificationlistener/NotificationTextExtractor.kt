package com.salimon.notificationlistener

import android.app.Notification

internal data class ExtractedNotificationMessage(
  val text: NotificationText,
  val receivedAt: Long,
  val messageKey: String,
)

internal object NotificationTextExtractor {
  fun extract(
    notification: Notification,
    packageName: String,
    notificationKey: String,
    postTime: Long,
  ): List<ExtractedNotificationMessage> {
    val extras = notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    if (PaymentNotificationFilter.isMessagingApp(packageName)) {
      // Group summaries repeat child messages and may combine different conversations.
      if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return emptyList()
      val bundles = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
      val messages = bundles?.let(Notification.MessagingStyle.Message::getMessagesFromBundleArray)
      if (!messages.isNullOrEmpty()) {
        return messages.mapNotNull { message ->
          val body = message.text?.toString()?.trim().orEmpty()
          if (body.isBlank()) return@mapNotNull null
          val sender = message.senderPerson?.name?.toString()?.takeIf(String::isNotBlank) ?: title
          val receivedAt = message.timestamp.takeIf { it > 0L } ?: postTime
          ExtractedNotificationMessage(
            text = NotificationText(sender, body, body),
            receivedAt = receivedAt,
            messageKey = "message:$receivedAt",
          )
        }
      }
    }

    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.joinToString("\n") { it.toString() }.orEmpty()
    val expandedText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?.toString()?.takeIf(String::isNotBlank) ?: lines
    return listOf(
      ExtractedNotificationMessage(
        text = NotificationText(
          title = title,
          text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty(),
          expandedText = expandedText,
        ),
        receivedAt = notification.`when`.takeIf { it > 0L } ?: postTime,
        messageKey = notificationKey,
      ),
    )
  }
}
