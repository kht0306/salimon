import styled from "@emotion/native"
import { formatKoreanDate } from "@salimon/domain"
import { observer } from "mobx-react-lite"
import { Pressable } from "react-native"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { BudgetOverview } from "./BudgetOverview"
import { DateSummaryStrip } from "./DateSummaryStrip"
import { LedgerMonthControls } from "./LedgerMonthControls"
import { MonthlySummary } from "./MonthlySummary"

interface DashboardHeaderProps {
  isWide: boolean
}

export const DashboardHeader = observer(function DashboardHeader({
  isWide,
}: DashboardHeaderProps) {
  const store = useMobileAppStore()
  const isRefreshing = store.dataStatus === "refreshing"

  return (
    <HeaderContent>
      <HeadingRow>
        <HeadingCopy>
          <Eyebrow>살림온 모바일 · 4회차</Eyebrow>
          <Title accessibilityRole="header">월별 홈</Title>
          <Subtitle>
            {store.currentLedgerName}의 수입·지출·저축을 한눈에 확인하세요.
          </Subtitle>
        </HeadingCopy>
        <RefreshButton
          accessibilityLabel="현재 월 새로고침"
          accessibilityRole="button"
          accessibilityState={{ disabled: isRefreshing }}
          disabled={isRefreshing}
          onPress={() => void store.refreshSelectedMonth()}
        >
          <RefreshLabel>{isRefreshing ? "갱신 중" : "새로고침"}</RefreshLabel>
        </RefreshButton>
      </HeadingRow>

      {store.dataStatus === "stale" ? (
        <OfflineNotice accessibilityLiveRegion="polite">
          <OfflineTitle>마지막 조회 · 읽기 전용</OfflineTitle>
          <OfflineDescription>
            {store.dataErrorMessage ??
              "네트워크 연결 후 아래로 당기거나 새로고침해 주세요."}
          </OfflineDescription>
        </OfflineNotice>
      ) : null}

      <LedgerMonthControls />

      <OverviewColumns $isWide={isWide}>
        <OverviewColumn>
          <MonthlySummary totals={store.monthTotals} />
        </OverviewColumn>
        <OverviewColumn>
          <BudgetOverview budgets={store.selectedMonthBudgets} />
        </OverviewColumn>
      </OverviewColumns>

      <DateSummaryStrip
        days={store.monthDaySummaries}
        selectedDate={store.selectedDate}
        onSelect={store.selectDate}
      />

      <SelectedDateHeading>
        <SelectedDateTitle>
          {formatKoreanDate(store.selectedDate)} 거래
        </SelectedDateTitle>
        <SelectedDateCount>
          {store.selectedDateTransactions.length}건
        </SelectedDateCount>
      </SelectedDateHeading>
    </HeaderContent>
  )
})

const HeaderContent = styled.View`
  gap: ${mobileTheme.spacing[4]}px;
  padding: ${mobileTheme.spacing[5]}px;
`

const HeadingRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[3]}px;
`

const HeadingCopy = styled.View`
  min-width: 0;
  flex: 1;
`

const Eyebrow = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
`

const Title = styled.Text`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.ink};
  font-size: 28px;
  font-weight: 800;
  line-height: 36px;
`

const Subtitle = styled.Text`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`

const RefreshButton = styled(Pressable)`
  min-height: 44px;
  justify-content: center;
  border-width: 1px;
  border-color: ${mobileTheme.colors.borderStrong};
  border-radius: ${mobileTheme.radii.sm}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[2]}px ${mobileTheme.spacing[3]}px;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`

const RefreshLabel = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 700;
`

const OfflineNotice = styled.View`
  border-left-width: 3px;
  border-left-color: ${mobileTheme.colors.coral};
  background-color: ${mobileTheme.colors.coralSoft};
  padding: ${mobileTheme.spacing[3]}px ${mobileTheme.spacing[4]}px;
`

const OfflineTitle = styled.Text`
  color: ${mobileTheme.colors.coral};
  font-size: 12px;
  font-weight: 700;
`

const OfflineDescription = styled.Text`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const OverviewColumns = styled.View<{ $isWide: boolean }>`
  flex-direction: ${({ $isWide }) => ($isWide ? "row" : "column")};
  align-items: stretch;
  gap: ${mobileTheme.spacing[4]}px;
`

const OverviewColumn = styled.View`
  min-width: 0;
  flex: 1;
`

const SelectedDateHeading = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[3]}px;
  margin-top: ${mobileTheme.spacing[2]}px;
`

const SelectedDateTitle = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
`

const SelectedDateCount = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  font-weight: 600;
`
