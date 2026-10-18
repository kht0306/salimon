package com.salimon.datetimepicker

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.text.format.DateFormat
import android.view.ContextThemeWrapper
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

internal object PickerDialogs {
  fun date(
    context: Context,
    value: String,
    darkMode: Boolean,
    onSelect: (String) -> Unit,
  ): DatePickerDialog {
    val date = LocalDate.parse(value)
    return DatePickerDialog(
      themedContext(context, darkMode),
      { _, year, month, day -> onSelect(LocalDate.of(year, month + 1, day).toString()) },
      date.year,
      date.monthValue - 1,
      date.dayOfMonth,
    )
  }

  fun time(
    context: Context,
    value: String,
    darkMode: Boolean,
    onSelect: (String) -> Unit,
  ): TimePickerDialog {
    val time = LocalTime.parse(value)
    return TimePickerDialog(
      themedContext(context, darkMode),
      { _, hour, minute -> onSelect(String.format(Locale.ROOT, "%02d:%02d", hour, minute)) },
      time.hour,
      time.minute,
      DateFormat.is24HourFormat(context),
    )
  }

  private fun themedContext(context: Context, darkMode: Boolean): Context =
    ContextThemeWrapper(
      context,
      if (darkMode) R.style.SalimonDateTimePicker_Dark else R.style.SalimonDateTimePicker_Light,
    )
}
