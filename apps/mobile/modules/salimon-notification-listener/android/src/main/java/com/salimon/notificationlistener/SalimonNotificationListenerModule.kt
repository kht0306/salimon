package com.salimon.notificationlistener

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

@OptimizedRecord
class NotificationCaptureConfiguration(
  @Field val allowedPackageNames: List<String> = emptyList(),
  @Field val enabled: Boolean = false,
) : Record

class SalimonNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SalimonNotificationListener")

    AsyncFunction("setAuthenticatedUser") { userId: String ->
      require(userId.isNotBlank()) { "인증 사용자 정보가 필요합니다." }
      val context = requireApplicationContext()
      val preferences = NotificationCapturePreferences(context)
      if (preferences.setAuthenticatedUser(userId)) {
        EncryptedNotificationStore(context).clearAll()
      }
    }

    AsyncFunction("clearSessionAndRecords") {
      val context = requireApplicationContext()
      NotificationCapturePreferences(context).clearSession()
      EncryptedNotificationStore(context).clearAll()
    }

    AsyncFunction("configureCapture") { configuration: NotificationCaptureConfiguration ->
      val context = requireApplicationContext()
      NotificationCapturePreferences(context).configureCollection(
        enabled = configuration.enabled,
        allowedPackageNames = configuration.allowedPackageNames,
        ownPackageName = context.packageName,
      )
      if (!NotificationCapturePreferences(context).snapshot().isCaptureActive) {
        EncryptedNotificationStore(context).clearAll()
      }
      getStatus(context)
    }

    AsyncFunction("getStatus") {
      getStatus(requireApplicationContext())
    }

    AsyncFunction("openNotificationAccessSettings") {
      requireApplicationContext().startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    AsyncFunction("readRecords") {
      val context = requireApplicationContext()
      val preferences = NotificationCapturePreferences(context).snapshot()
      if (preferences.sessionFingerprint.isBlank()) {
        EncryptedNotificationStore(context).clearAll()
        emptyList<Map<String, Any>>()
      } else {
        EncryptedNotificationStore(context)
          .readRecords(preferences.sessionFingerprint)
          .map(NotificationCaptureRecord::toBridgeMap)
      }
    }

    AsyncFunction("deleteRecord") { recordId: String ->
      EncryptedNotificationStore(requireApplicationContext())
        .deleteRecord(recordId)
    }

    AsyncFunction("deleteExpiredRecords") {
      EncryptedNotificationStore(requireApplicationContext())
        .deleteExpiredRecords()
    }

    AsyncFunction("deleteAllRecords") {
      EncryptedNotificationStore(requireApplicationContext()).clearAll()
    }
  }

  private fun getStatus(context: Context): Map<String, Any> {
    val preferences = NotificationCapturePreferences(context).snapshot()
    val store = EncryptedNotificationStore(context)
    return mapOf(
      "hasNotificationAccess" to NotificationAccessState.hasAccess(context),
      "isCollectionEnabled" to preferences.isCaptureActive,
      "allowedPackageNames" to preferences.allowedPackageNames.sorted(),
      "storedRecordCount" to store.countRecords(),
      "retentionDays" to NOTIFICATION_RETENTION_DAYS,
    )
  }

  private fun requireApplicationContext(): Context =
    requireNotNull(appContext.reactContext) {
      "Android 앱 컨텍스트를 사용할 수 없습니다."
    }.applicationContext
}
