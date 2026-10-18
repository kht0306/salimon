package com.salimon.datetimepicker

import android.app.Activity
import android.app.Instrumentation
import android.content.DialogInterface
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import java.io.File
import java.io.FileOutputStream

class PickerTestActivity : Activity()

class DateTimePickerInstrumentation : Instrumentation() {
  override fun onCreate(arguments: Bundle?) {
    super.onCreate(arguments)
    start()
  }

  override fun onStart() {
    var activity: Activity? = null
    try {
      val pickerActivity = startActivitySync(
        Intent(targetContext, PickerTestActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      activity = pickerActivity
      var selectedDate: String? = null
      lateinit var date: android.app.DatePickerDialog
      runOnMainSync {
        date = PickerDialogs.date(pickerActivity, "2028-02-28", false) {
          selectedDate = it
        }
        date.show()
        date.datePicker.updateDate(2028, 1, 29)
      }
      capturePreview("date-light.png")
      runOnMainSync { date.getButton(DialogInterface.BUTTON_POSITIVE).performClick() }
      waitForIdleSync()
      check(selectedDate == "2028-02-29")

      var selectedTime: String? = null
      lateinit var time: android.app.TimePickerDialog
      runOnMainSync {
        time = PickerDialogs.time(pickerActivity, "12:30", true) {
          selectedTime = it
        }
        time.show()
        time.updateTime(23, 5)
      }
      capturePreview("time-dark.png")
      runOnMainSync { time.getButton(DialogInterface.BUTTON_POSITIVE).performClick() }
      waitForIdleSync()
      check(selectedTime == "23:05")

      lateinit var cancelledDate: android.app.DatePickerDialog
      runOnMainSync {
        cancelledDate = PickerDialogs.date(pickerActivity, "2028-02-29", true) {
          selectedDate = it
        }
        cancelledDate.show()
        cancelledDate.datePicker.updateDate(2026, 11, 31)
      }
      capturePreview("date-dark.png")
      runOnMainSync { cancelledDate.getButton(DialogInterface.BUTTON_NEGATIVE).performClick() }
      waitForIdleSync()
      check(selectedDate == "2028-02-29")

      lateinit var cancelledTime: android.app.TimePickerDialog
      runOnMainSync {
        cancelledTime = PickerDialogs.time(pickerActivity, "23:05", false) {
          selectedTime = it
        }
        cancelledTime.show()
        cancelledTime.updateTime(0, 0)
      }
      capturePreview("time-light.png")
      runOnMainSync { cancelledTime.cancel() }
      waitForIdleSync()
      check(selectedTime == "23:05")
      finish(Activity.RESULT_OK, Bundle().apply {
        putString("checksPassed", "leap-day,time,light-dark,cancellation")
      })
    } catch (error: Throwable) {
      finish(Activity.RESULT_CANCELED, Bundle().apply {
        putString("failureType", error::class.java.simpleName)
      })
      throw error
    } finally {
      activity?.let { target -> runOnMainSync { target.finish() } }
    }
  }

  private fun capturePreview(name: String) {
    waitForIdleSync()
    uiAutomation.waitForIdle(500, 5000)
    val screenshot = uiAutomation.takeScreenshot()
    FileOutputStream(File(targetContext.cacheDir, name)).use { output ->
      screenshot.compress(Bitmap.CompressFormat.PNG, 100, output)
    }
    screenshot.recycle()
  }
}
