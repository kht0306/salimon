import styled from "@emotion/native"
import { useTheme } from "@emotion/react"
import { CalendarDays, Clock3 } from "lucide-react-native"
import { useRef, useState } from "react"
import { Alert, Keyboard } from "react-native"
import SalimonDateTimePicker from "../../../modules/salimon-date-time-picker/src"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

interface TransactionDateTimeFieldsProps {
  accessibilityPrefix: string
  date: string
  time: string
  dateLabel?: string
  timeLabel?: string
  disabled?: boolean
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}

interface DateTimeFieldProps {
  accessibilityLabel: string
  disabled: boolean
  kind: "date" | "time"
  label: string
  value: string
  onChange: (value: string) => void
}

export function TransactionDateTimeFields({
  accessibilityPrefix,
  date,
  time,
  dateLabel = "날짜 *",
  timeLabel = "시간 *",
  disabled = false,
  onDateChange,
  onTimeChange,
}: TransactionDateTimeFieldsProps) {
  return (
    <Row>
      <DateTimeField
        accessibilityLabel={`${accessibilityPrefix} 날짜`}
        disabled={disabled}
        kind="date"
        label={dateLabel}
        value={date}
        onChange={onDateChange}
      />
      <DateTimeField
        accessibilityLabel={`${accessibilityPrefix} 시간`}
        disabled={disabled}
        kind="time"
        label={timeLabel}
        value={time}
        onChange={onTimeChange}
      />
    </Row>
  )
}

function DateTimeField({
  accessibilityLabel,
  disabled,
  kind,
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  const theme = useTheme()
  const [picking, setPicking] = useState(false)
  const pickingRef = useRef(false)
  const Icon = kind === "date" ? CalendarDays : Clock3

  async function openPicker(): Promise<void> {
    if (!SalimonDateTimePicker || disabled || pickingRef.current) return
    pickingRef.current = true
    setPicking(true)
    Keyboard.dismiss()
    try {
      const selected = await (kind === "date"
        ? SalimonDateTimePicker.pickDate(value, theme.isDark)
        : SalimonDateTimePicker.pickTime(value, theme.isDark))
      if (selected !== null) onChange(selected)
    } catch {
      Alert.alert(
        "날짜·시간을 선택하지 못했습니다.",
        "잠시 후 다시 시도해 주세요.",
      )
    } finally {
      pickingRef.current = false
      setPicking(false)
    }
  }

  return (
    <Field>
      <Label>{label}</Label>
      {SalimonDateTimePicker ? (
        <SelectionButton
          accessibilityHint="선택창을 엽니다."
          accessibilityLabel={`${accessibilityLabel}, ${value}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || picking, busy: picking }}
          disabled={disabled || picking}
          onPress={() => void openPicker()}
        >
          <SelectionValue>{value}</SelectionValue>
          <Icon color={theme.colors.subtle} size={18} strokeWidth={2} />
        </SelectionButton>
      ) : (
        <Input
          accessibilityLabel={accessibilityLabel}
          autoCapitalize="none"
          editable={!disabled}
          keyboardType="numbers-and-punctuation"
          maxLength={kind === "date" ? 10 : 5}
          placeholder={kind === "date" ? "YYYY-MM-DD" : "HH:mm"}
          placeholderTextColor={theme.colors.subtle}
          value={value}
          onChangeText={onChange}
        />
      )}
    </Field>
  )
}

const Row = styled.View({ flexDirection: "row", gap: mobileTheme.spacing[3] })
const Field = styled.View({ flex: 1, minWidth: 0, gap: mobileTheme.spacing[2] })
const Label = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
}))
const SelectionButton = styled.Pressable(({ theme, disabled }) => ({
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: theme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: theme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[3],
  opacity: disabled ? 0.6 : 1,
}))
const SelectionValue = styled(AppText)(({ theme }) => ({
  flexShrink: 1,
  color: theme.colors.ink,
  fontSize: 13,
}))
const Input = styled.TextInput(({ theme }) => ({
  minHeight: 48,
  borderWidth: 1,
  borderColor: theme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: theme.colors.panel,
  color: theme.colors.ink,
  fontFamily: "Pretendard",
  fontSize: 13,
  paddingHorizontal: mobileTheme.spacing[3],
}))
