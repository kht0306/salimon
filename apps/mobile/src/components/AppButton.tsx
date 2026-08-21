import styled from "@emotion/native"
import { mobileTheme } from "../theme"
import { AppText } from "./AppText"

interface AppButtonProps {
  accessibilityLabel?: string
  disabled?: boolean
  label: string
  onPress: () => void
  tone?: "primary" | "secondary" | "kakao"
}

export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  tone = "secondary",
}: AppButtonProps) {
  return (
    <Button
      $tone={tone}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <ButtonLabel $tone={tone}>{label}</ButtonLabel>
    </Button>
  )
}

const Button = styled.Pressable<{
  $tone: NonNullable<AppButtonProps["tone"]>
}>(({ $tone, disabled }) => ({
  minHeight: mobileTheme.controls.prominent,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor:
    $tone === "secondary" ? mobileTheme.colors.borderStrong : "transparent",
  borderRadius: mobileTheme.radii.md,
  backgroundColor:
    $tone === "kakao"
      ? "#fee500"
      : $tone === "primary"
        ? mobileTheme.colors.teal
        : mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[4],
  opacity: disabled ? 0.45 : 1,
}))

const ButtonLabel = styled(AppText)<{
  $tone: NonNullable<AppButtonProps["tone"]>
}>`
  color: ${({ $tone }) =>
    $tone === "primary" ? mobileTheme.colors.panel : mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 600;
`
