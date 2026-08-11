import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import { useState } from "react"
import type { MobileCategoryBudgetProgress } from "../../stores/mobileAppStore"
import { mobileTheme } from "../../theme"

interface BudgetOverviewProps {
  budgets: MobileCategoryBudgetProgress[]
}

export function BudgetOverview({ budgets }: BudgetOverviewProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleBudgets = expanded ? budgets : budgets.slice(0, 4)

  return (
    <Panel>
      <PanelHeading>
        <PanelTitle>예산 사용</PanelTitle>
        {budgets.length > 0 ? (
          <BudgetCount>{budgets.length}개 항목</BudgetCount>
        ) : null}
      </PanelHeading>
      {budgets.length === 0 ? (
        <EmptyText>웹에서 설정한 지출 예산이 없습니다.</EmptyText>
      ) : (
        <BudgetList>
          {visibleBudgets.map(({ amount, category, spent }) => {
            const ratio = amount > 0 ? spent / amount : 0
            const percentage = Math.min(100, Math.max(0, ratio * 100))
            const isOverBudget = ratio > 1
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
                  <BudgetAmount $over={isOverBudget}>
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
                      backgroundColor: isOverBudget
                        ? mobileTheme.colors.coral
                        : category.color,
                    }}
                  />
                </ProgressTrack>
              </BudgetRow>
            )
          })}
          {budgets.length > 4 ? (
            <ExpandButton
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((value) => !value)}
            >
              <ExpandLabel>
                {expanded ? "간단히 보기" : "전체 보기"}
              </ExpandLabel>
            </ExpandButton>
          ) : null}
        </BudgetList>
      )}
    </Panel>
  )
}

const Panel = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const PanelHeading = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const PanelTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
`

const BudgetCount = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const EmptyText = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const BudgetList = styled.View({ gap: mobileTheme.spacing[3] })

const BudgetRow = styled.View({ gap: mobileTheme.spacing[2] })

const BudgetHeading = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const BudgetName = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 600;
`

const BudgetAmount = styled.Text<{ $over: boolean }>`
  flex-shrink: 1;
  color: ${({ $over }) =>
    $over ? mobileTheme.colors.coral : mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: ${({ $over }) => ($over ? 700 : 500)};
  line-height: 15px;
  text-align: right;
`

const ProgressTrack = styled.View({
  height: 5,
  overflow: "hidden",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.border,
})

const ProgressFill = styled.View({
  height: "100%",
  borderRadius: mobileTheme.radii.round,
})

const ExpandButton = styled.Pressable({
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  marginTop: mobileTheme.spacing[1],
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
})

const ExpandLabel = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 11px;
  font-weight: 800;
`
