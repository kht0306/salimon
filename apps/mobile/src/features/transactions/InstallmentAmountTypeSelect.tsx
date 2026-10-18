import styled from "@emotion/native"
import { useTheme } from "@emotion/react"
import { ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import { TransactionOptionPickerModal } from "./TransactionOptionPickerModal"

interface InstallmentAmountTypeSelectProps {
  disabled?: boolean
  value: "monthly" | "principal"
  onChange: (value: "monthly" | "principal") => void
}

const options = [
  { id: "monthly", label: "월별 납입액" },
  { id: "principal", label: "할부 원금" },
]

export function InstallmentAmountTypeSelect({
  disabled = false,
  value,
  onChange,
}: InstallmentAmountTypeSelectProps) {
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const label = value === "monthly" ? "월별 납입액" : "할부 원금"

  return (
    <>
      <SelectButton
        accessibilityLabel={`할부 금액 입력 방식, ${label}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: isOpen }}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
      >
        <SelectLabel>{label}</SelectLabel>
        <ChevronDown color={theme.colors.subtle} size={18} strokeWidth={2} />
      </SelectButton>
      {isOpen ? (
        <TransactionOptionPickerModal
          emptyMessage=""
          options={options}
          selectedId={value}
          title="할부 금액 입력 방식"
          onClose={() => setIsOpen(false)}
          onSelect={(id) => {
            if (id === "monthly" || id === "principal") onChange(id)
          }}
        />
      ) : null}
    </>
  )
}

const SelectButton = styled.Pressable(({ theme }) => ({
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.panel,
}))

const SelectLabel = styled(AppText)(({ theme }) => ({
  ...mobileTheme.typography.label,
  color: theme.colors.ink,
}))
