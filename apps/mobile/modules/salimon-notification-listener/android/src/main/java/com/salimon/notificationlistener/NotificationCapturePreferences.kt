package com.salimon.notificationlistener

import android.content.Context

internal class NotificationCapturePreferences(context: Context) {
  private val preferences = context.getSharedPreferences(
    PREFERENCES_NAME,
    Context.MODE_PRIVATE,
  )

  fun snapshot(): NotificationCapturePreferencesSnapshot =
    NotificationCapturePreferencesSnapshot(
      sessionFingerprint = preferences.getString(KEY_SESSION_FINGERPRINT, "")
        .orEmpty(),
      disclosureAcceptedAt = preferences.getLong(
        KEY_DISCLOSURE_ACCEPTED_AT,
        0L,
      ),
      isCollectionEnabled = preferences.getBoolean(
        KEY_COLLECTION_ENABLED,
        false,
      ),
      allowedPackageNames = preferences
        .getStringSet(KEY_ALLOWED_PACKAGES, emptySet())
        .orEmpty()
        .toSet(),
      targetLedgerId = preferences.getString(KEY_TARGET_LEDGER_ID, "")
        .orEmpty(),
      reviewNotificationsEnabled = preferences.getBoolean(
        KEY_REVIEW_NOTIFICATIONS_ENABLED,
        false,
      ),
    )

  fun setAuthenticatedUser(userId: String): Boolean {
    val newFingerprint = NotificationCaptureIdentity.sessionFingerprint(userId)
    val previousFingerprint = snapshot().sessionFingerprint
    val changed = previousFingerprint != newFingerprint
    val editor = preferences.edit()
      .putString(KEY_SESSION_FINGERPRINT, newFingerprint)

    if (changed && previousFingerprint.isNotBlank()) {
      editor
        .putBoolean(KEY_COLLECTION_ENABLED, false)
        .remove(KEY_ALLOWED_PACKAGES)
        .remove(KEY_DISCLOSURE_ACCEPTED_AT)
        .remove(KEY_REVIEW_NOTIFICATIONS_ENABLED)
        .remove(KEY_TARGET_LEDGER_ID)
    }

    check(editor.commit()) { "알림 수집 세션 설정을 저장하지 못했습니다." }
    return changed
  }

  fun configureCollection(
    enabled: Boolean,
    allowedPackageNames: List<String>,
    ownPackageName: String,
    targetLedgerId: String,
    reviewNotificationsEnabled: Boolean,
  ) {
    val validPackageNames = allowedPackageNames
      .asSequence()
      .map(String::trim)
      .filter { packageName ->
        packageName.isNotBlank() &&
          packageName != ownPackageName &&
          PACKAGE_NAME_PATTERN.matches(packageName)
      }
      .toSet()
    val normalizedTargetLedgerId = targetLedgerId.trim().take(200)
    val currentSnapshot = snapshot()
    val canEnable = currentSnapshot.hasDisclosureConsent &&
      currentSnapshot.sessionFingerprint.isNotBlank() &&
      validPackageNames.isNotEmpty() &&
      normalizedTargetLedgerId.isNotBlank()

    check(
      preferences.edit()
        .putStringSet(KEY_ALLOWED_PACKAGES, validPackageNames)
        .putBoolean(KEY_COLLECTION_ENABLED, enabled && canEnable)
        .putString(KEY_TARGET_LEDGER_ID, normalizedTargetLedgerId)
        .putBoolean(
          KEY_REVIEW_NOTIFICATIONS_ENABLED,
          reviewNotificationsEnabled && enabled && canEnable,
        )
        .commit(),
    ) { "알림 수집 설정을 저장하지 못했습니다." }
  }

  fun acceptDisclosure(acceptedAt: Long = System.currentTimeMillis()) {
    check(snapshot().sessionFingerprint.isNotBlank()) {
      "로그인한 사용자만 알림 개인정보 고지에 동의할 수 있습니다."
    }
    check(
      preferences.edit()
        .putLong(KEY_DISCLOSURE_ACCEPTED_AT, acceptedAt)
        .commit(),
    ) { "알림 개인정보 고지 동의를 저장하지 못했습니다." }
  }

  fun revokeDisclosure() {
    check(
      preferences.edit()
        .remove(KEY_DISCLOSURE_ACCEPTED_AT)
        .putBoolean(KEY_COLLECTION_ENABLED, false)
        .remove(KEY_ALLOWED_PACKAGES)
        .remove(KEY_REVIEW_NOTIFICATIONS_ENABLED)
        .remove(KEY_TARGET_LEDGER_ID)
        .commit(),
    ) { "알림 개인정보 고지 동의를 철회하지 못했습니다." }
  }

  fun clearSession() {
    check(preferences.edit().clear().commit()) {
      "알림 수집 세션을 삭제하지 못했습니다."
    }
  }

  companion object {
    private const val PREFERENCES_NAME = "salimon_notification_capture"
    private const val KEY_SESSION_FINGERPRINT = "session_fingerprint"
    private const val KEY_DISCLOSURE_ACCEPTED_AT = "disclosure_accepted_at"
    private const val KEY_COLLECTION_ENABLED = "collection_enabled"
    private const val KEY_ALLOWED_PACKAGES = "allowed_packages"
    private const val KEY_TARGET_LEDGER_ID = "target_ledger_id"
    private const val KEY_REVIEW_NOTIFICATIONS_ENABLED =
      "review_notifications_enabled"
    private val PACKAGE_NAME_PATTERN = Regex(
      pattern = """[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+""",
    )
  }
}
