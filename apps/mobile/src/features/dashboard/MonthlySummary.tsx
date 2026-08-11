import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { TransactionTotals } from "./dashboardPresentation"
import { mobileTheme } from "../../theme"

interface MonthlySummaryProps {
  totals: TransactionTotals
}

export function MonthlySummary({ totals }: MonthlySummaryProps) {
  const summaryItems = [
    { label: "수입", tone: "income" as const, value: totals.income },
    { label: "지출", tone: "expense" as const, value: totals.expense },
    { label: "저축", tone: "saving" as const, value: totals.saving },
  ]

  return (
    <Panel accessibilityLabel="이번 달 수입 지출 저축 합계">
      <PanelTitle>월 요약</PanelTitle>
      <SummaryGrid>
        {summaryItems.map((item) => (
          <SummaryItem key={item.tone}>
            <SummaryLabel>{item.label}</SummaryLabel>
            <SummaryValue $tone={item.tone}>
              {formatKrw(item.value)}
            </SummaryValue>
          </SummaryItem>
        ))}
      </SummaryGrid>
    </Panel>
  )
}

const Panel = styled.View`
  height: 100%;
  gap: ${mobileTheme.spacing[3]}px;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[4]}px;
`

const PanelTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
`

const SummaryGrid = styled.View`
  gap: ${mobileTheme.spacing[2]}px;
`

const SummaryItem = styled.View`
  min-height: 44px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[3]}px;
  border-left-width: 2px;
  border-left-color: ${mobileTheme.colors.borderStrong};
  padding: ${mobileTheme.spacing[2]}px ${mobileTheme.spacing[3]}px;
`

const SummaryLabel = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
  font-weight: 600;
`

const SummaryValue = styled.Text<{
  $tone: "expense" | "income" | "saving"
}>`
  flex-shrink: 1;
  color: ${({ $tone }) =>
    $tone === "income"
      ? mobileTheme.colors.green
      : $tone === "expense"
        ? mobileTheme.colors.coral
        : mobileTheme.colors.teal};
  font-size: 15px;
  font-weight: 800;
  line-height: 22px;
  text-align: right;
`
