package com.salimon.notificationlistener

import java.security.MessageDigest

internal object PaymentNotificationFilter {
  private val amountPattern = Regex(
    pattern = """(?i)(?:₩\s*)?\d{1,3}(?:,\d{3})+(?:\s*원)?|\d+\s*원|[A-Z]{3}\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?""",
  )
  private val paymentKeywordPattern = Regex(
    pattern = """승인|결제|이용|사용|출금|입금|취소|환불|체크|신용|일시불|할부""",
  )

  fun shouldStore(text: NotificationText): Boolean {
    val combined = text.combined()
    return combined.isNotBlank() &&
      amountPattern.containsMatchIn(combined) &&
      paymentKeywordPattern.containsMatchIn(combined)
  }
}

internal object SensitiveNotificationTextSanitizer {
  private val longNumberPattern = Regex(
    pattern = """(?<!\d)(?:\d[ -]?){7,19}(?!\d)""",
  )

  fun sanitize(text: NotificationText): NotificationText = NotificationText(
    title = sanitizeField(text.title),
    text = sanitizeField(text.text),
    expandedText = sanitizeField(text.expandedText),
  )

  private fun sanitizeField(value: String): String = longNumberPattern
    .replace(value) { match ->
      val followingText = value
        .substring(match.range.last + 1)
        .trimStart()
      if (followingText.startsWith("원")) {
        match.value
      } else {
        "[민감번호 숨김]"
      }
    }
    .trim()
}

internal object NotificationCaptureIdentity {
  fun sessionFingerprint(userId: String): String = sha256(userId.trim())

  fun recordId(
    packageName: String,
    notificationKey: String,
    receivedAt: Long,
    text: NotificationText,
  ): String = sha256(
    listOf(packageName, notificationKey, receivedAt.toString(), text.combined())
      .joinToString("\u0000"),
  )

  private fun sha256(value: String): String = MessageDigest
    .getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString(separator = "") { byte -> "%02x".format(byte) }
}
