import styled from "@emotion/native"
import { mobileTheme } from "../theme"

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

const Button = styled.Pressable<{ $tone: NonNullable<AppButtonProps["tone"]> }>`
  min-height: 48px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${({ $tone }) =>
    $tone === "secondary" ? mobileTheme.colors.borderStrong : "transparent"};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${({ $tone }) => {
    if ($tone === "kakao") return "#fee500"
    if ($tone === "primary") return mobileTheme.colors.teal
    return mobileTheme.colors.panel
  }};
  padding: ${mobileTheme.spacing[3]}px ${mobileTheme.spacing[4]}px;
  opacity: ${({ disabled }) => (disabled ? 0.45 : 1)};
`

const ButtonLabel = styled.Text<{
  $tone: NonNullable<AppButtonProps["tone"]>
}>`
  color: ${({ $tone }) =>
    $tone === "primary" ? mobileTheme.colors.panel : mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 700;
`
