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
      <AppBar>
        <BrandLockup>
          <BrandMark>
            <BrandInitial>S</BrandInitial>
          </BrandMark>
          <BrandCopy>
            <BrandName>살림온</BrandName>
            <BrandContext>{store.currentLedgerName}</BrandContext>
          </BrandCopy>
        </BrandLockup>
        <RefreshButton
          accessibilityLabel="현재 월 새로고침"
          accessibilityRole="button"
          accessibilityState={{ disabled: isRefreshing }}
          disabled={isRefreshing}
          onPress={() => void store.refreshSelectedMonth()}
        >
          <RefreshLabel>{isRefreshing ? "갱신 중" : "새로 고침"}</RefreshLabel>
        </RefreshButton>
      </AppBar>

      <HeadingCopy>
        <Eyebrow>
          {store.authUser?.nickname ?? "가족"}님의 이번 달 가계부
        </Eyebrow>
        <Title accessibilityRole="header">생활비 한눈에 보기</Title>
        <Subtitle>월별 흐름과 오늘의 거래를 빠르게 확인하세요.</Subtitle>
      </HeadingCopy>

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

const HeaderContent = styled.View({
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const AppBar = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const BrandLockup = styled.View({
  minWidth: 0,
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const BrandMark = styled.View({
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.ink,
})

const BrandInitial = styled.Text`
  color: ${mobileTheme.colors.panel};
  font-size: 16px;
  font-weight: 900;
`

const BrandCopy = styled.View({ minWidth: 0, flex: 1 })

const BrandName = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 900;
`

const BrandContext = styled.Text`
  margin-top: 1px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const HeadingCopy = styled.View({
  minWidth: 0,
  gap: mobileTheme.spacing[1],
})

const Eyebrow = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 11px;
  font-weight: 800;
`

const Title = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
  line-height: 31px;
`

const Subtitle = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const RefreshButton = styled(Pressable)<{ disabled?: boolean }>(
  ({ disabled }) => ({
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.panel,
    paddingVertical: mobileTheme.spacing[2],
    paddingHorizontal: mobileTheme.spacing[3],
    opacity: disabled ? 0.5 : 1,
  }),
)

const RefreshLabel = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 11px;
  font-weight: 800;
`

const OfflineNotice = styled.View({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.coralSoft,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

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

const OverviewColumns = styled.View<{ $isWide: boolean }>(({ $isWide }) => ({
  flexDirection: $isWide ? "row" : "column",
  alignItems: "stretch",
  gap: mobileTheme.spacing[4],
}))

const OverviewColumn = styled.View({ minWidth: 0, flex: 1 })

const SelectedDateHeading = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  marginTop: mobileTheme.spacing[1],
})

const SelectedDateTitle = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 16px;
  font-weight: 800;
  line-height: 23px;
`

const SelectedDateCount = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  font-weight: 600;
`
