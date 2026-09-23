package com.salimon.notificationlistener

import java.security.MessageDigest

internal object PaymentNotificationFilter {
  private val messagePackages = setOf(
    "com.samsung.android.messaging",
    "com.google.android.apps.messaging",
    "com.kakao.talk",
  )
  private val approvalHeader = Regex("""(?:KB\s*국민카드\s*\d{4}|우리\s*\(\d{4}\))\s*승인""")
  private val excludedEvent = Regex("""취소|환불|환급|거절|승인\s*실패""")
  private val amountPattern = Regex(
    pattern = """(?i)(?:₩\s*)?\d{1,3}(?:,\d{3})+(?:\s*원)?|\d+\s*원|[A-Z]{3}\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?""",
  )
  private val paymentKeywordPattern = Regex(
    pattern = """승인|결제|이용|사용|출금|입금|취소|환불|체크|신용|일시불|할부""",
  )

  fun isMessagingApp(packageName: String): Boolean = packageName in messagePackages

  fun shouldStore(text: NotificationText, packageName: String = ""): Boolean {
    val combined = text.combined()
    if (isMessagingApp(packageName)) {
      val body = text.expandedText.ifBlank { text.text }
      if (approvalHeader.findAll(body).count() != 1 || excludedEvent.containsMatchIn(combined)) {
        return false
      }
      if (packageName == "com.kakao.talk" &&
        !Regex("""우리카드|KB\s*국민카드""").containsMatchIn(text.title)) {
        return false
      }
    }
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
