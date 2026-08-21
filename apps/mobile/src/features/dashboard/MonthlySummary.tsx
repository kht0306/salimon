import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { TransactionTotals } from "./dashboardPresentation"
import { AppText } from "../../components/AppText"
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
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[5],
})

const HeroLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  font-weight: 600;
`

const HeroValue = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 40px;
`

const SummaryDivider = styled.View({
  height: 1,
  marginVertical: mobileTheme.spacing[2],
  backgroundColor: mobileTheme.colors.border,
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

const SummaryLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
  font-weight: 600;
`

const SummaryValue = styled(AppText)<{
  $tone: "expense" | "income" | "saving"
}>`
  flex-shrink: 1;
  color: ${({ $tone }) =>
    $tone === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 600;
  line-height: 19px;
`
