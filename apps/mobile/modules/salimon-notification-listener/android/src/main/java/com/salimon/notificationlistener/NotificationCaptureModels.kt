package com.salimon.notificationlistener

internal const val NOTIFICATION_RETENTION_DAYS = 7
internal const val NOTIFICATION_RETENTION_MILLIS =
  NOTIFICATION_RETENTION_DAYS * 24L * 60L * 60L * 1000L

internal data class NotificationText(
  val title: String,
  val text: String,
  val expandedText: String,
) {
  fun combined(): String = listOf(title, text, expandedText)
    .filter(String::isNotBlank)
    .joinToString("\n")
}

internal data class NotificationCaptureRecord(
  val id: String,
  val sourcePackageName: String,
  val receivedAt: Long,
  val capturedAt: Long,
  val title: String,
  val text: String,
  val expandedText: String,
) {
  fun toBridgeMap(): Map<String, Any> = mapOf(
    "id" to id,
    "sourcePackageName" to sourcePackageName,
    "receivedAt" to receivedAt,
    "capturedAt" to capturedAt,
    "title" to title,
    "text" to text,
    "expandedText" to expandedText,
  )
}

internal data class NotificationCapturePreferencesSnapshot(
  val sessionFingerprint: String,
  val isCollectionEnabled: Boolean,
  val allowedPackageNames: Set<String>,
) {
  val isCaptureActive: Boolean
    get() = sessionFingerprint.isNotBlank() &&
      isCollectionEnabled &&
      allowedPackageNames.isNotEmpty()
}
