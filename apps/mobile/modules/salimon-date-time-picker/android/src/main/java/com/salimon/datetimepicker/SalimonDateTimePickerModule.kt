package com.salimon.datetimepicker

import android.app.Dialog
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SalimonDateTimePickerModule : Module() {
  private var activeDialog: Dialog? = null

  override fun definition() = ModuleDefinition {
    Name("SalimonDateTimePicker")

    AsyncFunction("pickDate") { value: String, darkMode: Boolean, promise: Promise ->
      var selectedValue: String? = null
      val dialog = PickerDialogs.date(appContext.throwingActivity, value, darkMode) {
        selectedValue = it
      }
      showDialog(dialog, promise) { selectedValue }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pickTime") { value: String, darkMode: Boolean, promise: Promise ->
      var selectedValue: String? = null
      val dialog = PickerDialogs.time(appContext.throwingActivity, value, darkMode) {
        selectedValue = it
      }
      showDialog(dialog, promise) { selectedValue }
    }.runOnQueue(Queues.MAIN)

    OnActivityDestroys {
      activeDialog?.dismiss()
    }
  }

  private fun showDialog(dialog: Dialog, promise: Promise, selectedValue: () -> String?) {
    activeDialog?.dismiss()
    dialog.setOnDismissListener {
      if (activeDialog === dialog) activeDialog = null
      promise.resolve(selectedValue())
    }
    dialog.show()
    activeDialog = dialog
  }
}
