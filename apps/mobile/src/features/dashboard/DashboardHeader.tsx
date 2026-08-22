import styled from "@emotion/native"
import { router } from "expo-router"
import { Plus, RefreshCw } from "lucide-react-native"
import { observer } from "mobx-react-lite"
import { Pressable } from "react-native"
import { AppText } from "../../components/AppText"
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
        <BrandLockup
          accessibilityLabel={`살림온, ${store.currentLedgerName}`}
          accessible
        >
          <BrandMark>
            <BrandInitial>살</BrandInitial>
          </BrandMark>
          <BrandCopy>
            <BrandName numberOfLines={1}>살림온</BrandName>
            <BrandContext numberOfLines={1}>
              {store.currentLedgerName}
            </BrandContext>
          </BrandCopy>
        </BrandLockup>
        <AppBarActions>
          {store.canMutateCurrentLedger ? (
            <CreateButton
              accessibilityLabel="새 거래 추가"
              accessibilityRole="button"
              onPress={() => router.push("/transactions/new")}
            >
              <Plus
                color={mobileTheme.colors.panel}
                size={19}
                strokeWidth={2}
              />
            </CreateButton>
          ) : null}
          <RefreshButton
            accessibilityLabel="현재 월 새로고침"
            accessibilityRole="button"
            accessibilityState={{ disabled: isRefreshing }}
            disabled={isRefreshing}
            onPress={() => void store.refreshSelectedMonth()}
          >
            <RefreshCw
              color={mobileTheme.colors.muted}
              size={18}
              strokeWidth={1.8}
            />
          </RefreshButton>
        </AppBarActions>
      </AppBar>

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
          {formatSelectedDate(store.selectedDate)} 거래
        </SelectedDateTitle>
        <SelectedDateCount>
          {store.selectedDateTransactions.length}건
        </SelectedDateCount>
      </SelectedDateHeading>
    </HeaderContent>
  )
})

function formatSelectedDate(date: string): string {
  const [, month = "", day = ""] = date.split("-")
  return `${Number(month)}월 ${Number(day)}일`
}

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
  backgroundColor: mobileTheme.colors.teal,
})

const BrandInitial = styled(AppText)`
  color: ${mobileTheme.colors.panel};
  font-size: 13px;
  font-weight: 700;
`

const BrandCopy = styled.View({
  minWidth: 0,
  flex: 1,
})

const AppBarActions = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const BrandName = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 700;
`

const BrandContext = styled(AppText)`
  margin-top: 1px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const RefreshButton = styled(Pressable)<{ disabled?: boolean }>(
  ({ disabled }) => ({
    width: mobileTheme.controls.touch,
    minHeight: mobileTheme.controls.touch,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.panel,
    opacity: disabled ? 0.5 : 1,
  }),
)

const CreateButton = styled(Pressable)({
  width: mobileTheme.controls.touch,
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.teal,
})

const OfflineNotice = styled.View({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.coralSoft,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const OfflineTitle = styled(AppText)`
  color: ${mobileTheme.colors.coral};
  font-size: 12px;
  font-weight: 700;
`

const OfflineDescription = styled(AppText)`
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

const SelectedDateTitle = styled(AppText)`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 16px;
  font-weight: 600;
  line-height: 23px;
`

const SelectedDateCount = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  font-weight: 600;
`
