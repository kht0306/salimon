package com.salimon.notificationlistener

import android.content.ComponentName
import android.content.Context
import android.provider.Settings

internal object NotificationAccessState {
  fun hasAccess(context: Context): Boolean {
    val enabledComponents = Settings.Secure.getString(
      context.contentResolver,
      ENABLED_NOTIFICATION_LISTENERS_SETTING,
    ).orEmpty()
    val expectedComponent = ComponentName(
      context,
      SalimonNotificationListenerService::class.java,
    )

    return enabledComponents
      .split(':')
      .mapNotNull(ComponentName::unflattenFromString)
      .any { component -> component == expectedComponent }
  }

  private const val ENABLED_NOTIFICATION_LISTENERS_SETTING =
    "enabled_notification_listeners"
}
