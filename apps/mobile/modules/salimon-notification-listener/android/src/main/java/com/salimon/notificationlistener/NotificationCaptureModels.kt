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
  val registrationState: NotificationRegistrationState? = null,
) {
  fun toBridgeMap(): Map<String, Any> = buildMap {
    put("id", id)
    put("sourcePackageName", sourcePackageName)
    put("receivedAt", receivedAt)
    put("capturedAt", capturedAt)
    put("title", title)
    put("text", text)
    put("expandedText", expandedText)
    registrationState?.let { state ->
      put("registrationState", state.toBridgeMap())
    }
  }
}

internal data class NotificationRegistrationState(
  val amount: Long,
  val categoryId: String,
  val merchantName: String,
  val paymentMethodId: String,
  val targetLedgerId: String,
  val transactionAt: String,
  val updatedAt: Long,
) {
  fun toBridgeMap(): Map<String, Any> = mapOf(
    "amount" to amount,
    "categoryId" to categoryId,
    "merchantName" to merchantName,
    "paymentMethodId" to paymentMethodId,
    "targetLedgerId" to targetLedgerId,
    "transactionAt" to transactionAt,
    "updatedAt" to updatedAt,
  )
}

internal data class NotificationCapturePreferencesSnapshot(
  val sessionFingerprint: String,
  val disclosureAcceptedAt: Long,
  val isCollectionEnabled: Boolean,
  val allowedPackageNames: Set<String>,
  val targetLedgerId: String,
  val reviewNotificationsEnabled: Boolean,
) {
  val hasDisclosureConsent: Boolean
    get() = disclosureAcceptedAt > 0L

  val isCaptureActive: Boolean
    get() = hasDisclosureConsent &&
      sessionFingerprint.isNotBlank() &&
      isCollectionEnabled &&
      allowedPackageNames.isNotEmpty() &&
      targetLedgerId.isNotBlank()
}
