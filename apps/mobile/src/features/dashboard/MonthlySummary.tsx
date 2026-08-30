import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import { Eye, EyeOff } from "lucide-react-native"
import type { TransactionTotals } from "./dashboardPresentation"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

interface MonthlySummaryProps {
  disabled?: boolean
  totals: TransactionTotals
  visible: boolean
  onToggle: () => void
}

export function MonthlySummary({
  disabled = false,
  totals,
  visible,
  onToggle,
}: MonthlySummaryProps) {
  return (
    <Panel
      accessibilityHint={
        visible ? "누르면 금액을 숨깁니다." : "누르면 금액을 표시합니다."
      }
      accessibilityLabel={
        visible
          ? `이번 달 지출 ${formatKrw(totals.expense)}, 수입 ${formatKrw(totals.income)}, 저축 ${formatKrw(totals.saving)}`
          : "이번 달 지출, 수입, 저축 금액 숨김"
      }
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onToggle}
    >
      <HeroLabelRow>
        <HeroLabel>이번 달 지출</HeroLabel>
        {visible ? (
          <EyeOff
            color={mobileTheme.colors.muted}
            size={17}
            strokeWidth={1.8}
          />
        ) : (
          <Eye color={mobileTheme.colors.muted} size={17} strokeWidth={1.8} />
        )}
      </HeroLabelRow>
      <HeroValue $hidden={!visible}>
        {visible ? formatKrw(totals.expense) : "••••••"}
      </HeroValue>
      <SummaryGrid>
        <SummaryItem>
          <SummaryLabel>들어온 돈</SummaryLabel>
          <SummaryValue $tone={visible ? "income" : "hidden"}>
            {visible ? formatKrw(totals.income) : "••••••"}
          </SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <SummaryLabel>저축한 돈</SummaryLabel>
          <SummaryValue $tone={visible ? "saving" : "hidden"}>
            {visible ? formatKrw(totals.saving) : "••••••"}
          </SummaryValue>
        </SummaryItem>
      </SummaryGrid>
    </Panel>
  )
}

const Panel = styled.Pressable(({ disabled }) => ({
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingTop: mobileTheme.spacing[1],
  paddingBottom: mobileTheme.spacing[5],
  opacity: disabled ? 0.72 : 1,
}))

const HeroLabelRow = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
})

const HeroLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: ${mobileTheme.typography.label.fontSize}px;
  font-weight: ${mobileTheme.typography.label.fontWeight};
  line-height: ${mobileTheme.typography.label.lineHeight}px;
`

const HeroValue = styled(AppText)<{ $hidden: boolean }>`
  color: ${({ $hidden }) =>
    $hidden ? mobileTheme.colors.muted : mobileTheme.colors.ink};
  font-size: ${mobileTheme.typography.display.fontSize}px;
  font-weight: ${mobileTheme.typography.display.fontWeight};
  letter-spacing: -0.5px;
  line-height: 40px;
`

const SummaryGrid = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[5],
})

const SummaryItem = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const SummaryLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: ${mobileTheme.typography.caption.fontSize}px;
  font-weight: 600;
  line-height: ${mobileTheme.typography.caption.lineHeight}px;
`

const SummaryValue = styled(AppText)<{
  $tone: "hidden" | "income" | "saving"
}>`
  flex-shrink: 1;
  color: ${({ $tone }) =>
    $tone === "income"
      ? mobileTheme.colors.green
      : $tone === "hidden"
        ? mobileTheme.colors.muted
        : mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 600;
  line-height: 19px;
`
