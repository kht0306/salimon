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
      isCollectionEnabled = preferences.getBoolean(
        KEY_COLLECTION_ENABLED,
        false,
      ),
      allowedPackageNames = preferences
        .getStringSet(KEY_ALLOWED_PACKAGES, emptySet())
        .orEmpty()
        .toSet(),
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
    }

    check(editor.commit()) { "알림 수집 세션 설정을 저장하지 못했습니다." }
    return changed
  }

  fun configureCollection(
    enabled: Boolean,
    allowedPackageNames: List<String>,
    ownPackageName: String,
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
    val canEnable = snapshot().sessionFingerprint.isNotBlank() &&
      validPackageNames.isNotEmpty()

    check(
      preferences.edit()
        .putStringSet(KEY_ALLOWED_PACKAGES, validPackageNames)
        .putBoolean(KEY_COLLECTION_ENABLED, enabled && canEnable)
        .commit(),
    ) { "알림 수집 설정을 저장하지 못했습니다." }
  }

  fun clearSession() {
    check(preferences.edit().clear().commit()) {
      "알림 수집 세션을 삭제하지 못했습니다."
    }
  }

  companion object {
    private const val PREFERENCES_NAME = "salimon_notification_capture"
    private const val KEY_SESSION_FINGERPRINT = "session_fingerprint"
    private const val KEY_COLLECTION_ENABLED = "collection_enabled"
    private const val KEY_ALLOWED_PACKAGES = "allowed_packages"
    private val PACKAGE_NAME_PATTERN = Regex(
      pattern = """[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+""",
    )
  }
}
