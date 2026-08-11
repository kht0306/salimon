import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { TransactionTotals } from "./dashboardPresentation"
import { mobileTheme } from "../../theme"

interface MonthlySummaryProps {
  totals: TransactionTotals
}

export function MonthlySummary({ totals }: MonthlySummaryProps) {
  return (
    <Panel accessibilityLabel="이번 달 수입 지출 저축 합계">
      <HeroLabel>이번 달 지출</HeroLabel>
      <HeroValue>{formatKrw(totals.expense)}</HeroValue>
      <SummaryDivider />
      <SummaryGrid>
        <SummaryItem>
          <SummaryLabel>들어온 돈</SummaryLabel>
          <SummaryValue $tone="income">{formatKrw(totals.income)}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <SummaryLabel>저축한 돈</SummaryLabel>
          <SummaryValue $tone="saving">{formatKrw(totals.saving)}</SummaryValue>
        </SummaryItem>
      </SummaryGrid>
    </Panel>
  )
}

const Panel = styled.View({
  gap: mobileTheme.spacing[2],
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.ink,
  padding: mobileTheme.spacing[5],
})

const HeroLabel = styled.Text`
  color: ${mobileTheme.colors.borderStrong};
  font-size: 11px;
  font-weight: 700;
`

const HeroValue = styled.Text`
  color: ${mobileTheme.colors.panel};
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.7px;
  line-height: 38px;
`

const SummaryDivider = styled.View({
  height: 1,
  marginVertical: mobileTheme.spacing[2],
  backgroundColor: "#3f3f46",
})

const SummaryGrid = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[5],
})

const SummaryItem = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const SummaryLabel = styled.Text`
  color: ${mobileTheme.colors.subtle};
  font-size: 10px;
  font-weight: 600;
`

const SummaryValue = styled.Text<{
  $tone: "expense" | "income" | "saving"
}>`
  flex-shrink: 1;
  color: ${({ $tone }) =>
    $tone === "income"
      ? "#93c5fd"
      : $tone === "expense"
        ? "#fcd34d"
        : "#c4b5fd"};
  font-size: 13px;
  font-weight: 800;
  line-height: 19px;
`
