import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { MobileCategoryBudgetProgress } from "../../stores/mobileAppStore"
import { mobileTheme } from "../../theme"

interface BudgetOverviewProps {
  budgets: MobileCategoryBudgetProgress[]
}

export function BudgetOverview({ budgets }: BudgetOverviewProps) {
  return (
    <Panel>
      <PanelTitle>예산 사용</PanelTitle>
      {budgets.length === 0 ? (
        <EmptyText>웹에서 설정한 지출 예산이 없습니다.</EmptyText>
      ) : (
        <BudgetList>
          {budgets.map(({ amount, category, spent }) => {
            const ratio = amount > 0 ? spent / amount : 0
            const percentage = Math.min(100, Math.max(0, ratio * 100))
            return (
              <BudgetRow
                key={category.id}
                accessible
                accessibilityLabel={`${category.name}, ${formatKrw(
                  spent,
                )} 사용, ${formatKrw(amount)} 예산`}
              >
                <BudgetHeading>
                  <BudgetName>{category.name}</BudgetName>
                  <BudgetAmount>
                    {formatKrw(spent)} / {formatKrw(amount)}
                  </BudgetAmount>
                </BudgetHeading>
                <ProgressTrack
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: amount,
                    now: Math.min(spent, amount),
                  }}
                >
                  <ProgressFill
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: category.color,
                    }}
                  />
                </ProgressTrack>
              </BudgetRow>
            )
          })}
        </BudgetList>
      )}
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

const EmptyText = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const BudgetList = styled.View`
  gap: ${mobileTheme.spacing[3]}px;
`

const BudgetRow = styled.View`
  gap: ${mobileTheme.spacing[2]}px;
`

const BudgetHeading = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[3]}px;
`

const BudgetName = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 600;
`

const BudgetAmount = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
  text-align: right;
`

const ProgressTrack = styled.View`
  height: 5px;
  overflow: hidden;
  border-radius: ${mobileTheme.radii.round}px;
  background-color: ${mobileTheme.colors.border};
`

const ProgressFill = styled.View`
  height: 100%;
  border-radius: ${mobileTheme.radii.round}px;
`
