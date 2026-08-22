import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import { router } from "expo-router"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { LedgerMonthControls } from "../dashboard/LedgerMonthControls"
import {
  createLedgerTransactionsCsv,
  safeDataFilename,
} from "../data/dataExport"
import { shareDataFile } from "../data/mobileDataFiles"
import { SettlementBreakdown } from "./SettlementBreakdown"
import { SettlementSkeleton } from "./SettlementSkeleton"
import {
  buildSettlementExpenseTrend,
  buildMobileSettlementSummary,
  getSettlementRoleAccess,
  getSettlementTrendRange,
  summarizeVisiblePaymentMethods,
} from "./settlementPresentation"

const safeAreaEdges = ["top"] as const

export const SettlementScreen = observer(function SettlementScreen() {
  const store = useMobileAppStore()
  const persistedMonthNote = store.selectedMonthNote?.note ?? ""
  const [monthNote, setMonthNote] = useState(persistedMonthNote)
  const [exportError, setExportError] = useState<string>()
  const trendRange = useMemo(
    () => getSettlementTrendRange(store.selectedMonth),
    [store.selectedMonth],
  )
  const trendRangeKey = `${trendRange.startDate}:${trendRange.endDate}`

  useEffect(() => {
    setMonthNote(persistedMonthNote)
  }, [persistedMonthNote, store.selectedLedgerId, store.selectedMonth])

  useEffect(() => {
    if (
      !store.authUser?.id ||
      store.transactionSearchRangeKey === trendRangeKey
    )
      return
    void store.loadTransactionSearchRange(
      trendRange.startDate,
      trendRange.endDate,
    )
  }, [
    store,
    store.authUser?.id,
    store.selectedLedgerId,
    store.selectedMonth,
    store.transactionSearchRangeKey,
    trendRange.endDate,
    trendRange.startDate,
    trendRangeKey,
  ])

  const trend = useMemo(() => {
    const transactions =
      store.transactionSearchStatus === "ready" &&
      store.transactionSearchRangeKey === trendRangeKey
        ? (store.transactionSearchTransactions ?? [])
        : store.financeData.transactions
    return buildSettlementExpenseTrend(
      transactions,
      store.selectedLedgerId,
      store.selectedMonth,
    )
  }, [
    store.financeData.transactions,
    store.selectedLedgerId,
    store.selectedMonth,
    store.transactionSearchRangeKey,
    store.transactionSearchStatus,
    store.transactionSearchTransactions,
    trendRangeKey,
  ])
  const summary = useMemo(
    () =>
      buildMobileSettlementSummary({
        budgets: store.financeData.categoryBudgets,
        categories: store.financeData.categories,
        ledgerId: store.selectedLedgerId,
        members: store.financeData.members,
        month: store.selectedMonth,
        splits: store.financeData.transactionSplits,
        transactions: store.financeData.transactions,
      }),
    [
      store.financeData.categories,
      store.financeData.categoryBudgets,
      store.financeData.members,
      store.financeData.transactionSplits,
      store.financeData.transactions,
      store.selectedLedgerId,
      store.selectedMonth,
    ],
  )

  async function shareSettlementCsv(): Promise<void> {
    const ledger = store.currentLedger
    if (!ledger) return
    setExportError(undefined)
    try {
      await shareDataFile({
        content: createLedgerTransactionsCsv(
          store.financeData,
          store.selectedLedgerId,
        ),
        dialogTitle: `${store.selectedMonth} 월 정산 CSV`,
        filename: `salimon-${safeDataFilename(ledger.name)}-${
          store.selectedMonth
        }-settlement.csv`,
        mimeType: "text/csv",
      })
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "정산 CSV를 공유하지 못했습니다.",
      )
    }
  }

  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return <SettlementSkeleton />
  }
  if (store.dataStatus === "error") {
    return (
      <SettlementState
        actionLabel="다시 불러오기"
        message={store.dataErrorMessage ?? "정산 데이터를 불러오지 못했습니다."}
        onAction={() => void store.refreshSelectedMonth()}
      />
    )
  }

  const currentLedger = store.currentLedger
  if (!currentLedger) {
    return <SettlementState message="정산할 가계부가 없습니다." />
  }

  const currentMembers = store.financeData.members.filter(
    (member) =>
      member.ledgerId === store.selectedLedgerId && member.status === "active",
  )
  const roleAccess = getSettlementRoleAccess(currentLedger.role)
  const paymentMethodSummary = summarizeVisiblePaymentMethods(
    store.financeData.paymentMethods,
    store.selectedLedgerId,
    store.authUser?.id ?? "",
  )
  const isRefreshing = store.dataStatus === "refreshing"

  return (
    <Page edges={safeAreaEdges}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[mobileTheme.colors.teal]}
            refreshing={isRefreshing}
            tintColor={mobileTheme.colors.teal}
            onRefresh={() => void store.refreshSelectedMonth()}
          />
        }
      >
        <Content>
          <HeadingRow>
            <HeadingCopy>
              <Eyebrow>
                {currentLedger.type === "shared"
                  ? "공동 가계부"
                  : "개인 가계부"}
              </Eyebrow>
              <Title accessibilityRole="header">월 정산</Title>
              <Subtitle>
                확정 거래를 기준으로 이번 달 생활비 흐름을 정리했습니다.
              </Subtitle>
            </HeadingCopy>
            <RoleStatus $viewer={!roleAccess.canEditTransactions}>
              <RoleStatusLabel $viewer={!roleAccess.canEditTransactions}>
                {roleAccess.label}
              </RoleStatusLabel>
              <RoleStatusHint>
                {roleAccess.canEditTransactions
                  ? "거래 편집 가능"
                  : "조회 전용"}
              </RoleStatusHint>
            </RoleStatus>
          </HeadingRow>

          <LedgerMonthControls />

          {store.dataStatus === "stale" ? (
            <StaleNotice accessibilityLiveRegion="polite">
              마지막으로 불러온 정산을 읽기 전용으로 표시하고 있습니다.
            </StaleNotice>
          ) : null}

          {store.managementErrorMessage ? (
            <FeedbackNotice $error accessibilityRole="alert">
              {store.managementErrorMessage}
            </FeedbackNotice>
          ) : null}
          {store.managementNoticeMessage ? (
            <FeedbackNotice $error={false} accessibilityLiveRegion="polite">
              {store.managementNoticeMessage}
            </FeedbackNotice>
          ) : null}
          {store.transactionSearchStatus === "error" ? (
            <FeedbackNotice $error accessibilityRole="alert">
              {store.transactionSearchErrorMessage ??
                "최근 3개월 지출을 불러오지 못했습니다."}
            </FeedbackNotice>
          ) : null}
          {exportError ? (
            <FeedbackNotice $error accessibilityRole="alert">
              {exportError}
            </FeedbackNotice>
          ) : null}

          <RuleNotice>
            <RuleTitle>정산 기준</RuleTitle>
            <RuleDescription>
              확정 거래만 모든 금액에 포함합니다. 제외 거래는 기록에 남지만 월
              정산 금액에서는 빠집니다.
            </RuleDescription>
          </RuleNotice>

          <AppButton
            label={`${store.selectedMonth} 정산 CSV 공유`}
            onPress={() => void shareSettlementCsv()}
          />

          <PrimaryCard>
            <PrimaryLabel>확정 지출</PrimaryLabel>
            <PrimaryAmount>{formatKrw(summary.totals.expense)}</PrimaryAmount>
            <PrimaryDivider />
            <PrimaryMetrics>
              <PrimaryMetric>
                <PrimaryMetricLabel>들어온 돈</PrimaryMetricLabel>
                <PrimaryMetricValue $tone="income">
                  {formatKrw(summary.totals.income)}
                </PrimaryMetricValue>
              </PrimaryMetric>
              <PrimaryMetric>
                <PrimaryMetricLabel>저축한 돈</PrimaryMetricLabel>
                <PrimaryMetricValue $tone="saving">
                  {formatKrw(summary.totals.saving)}
                </PrimaryMetricValue>
              </PrimaryMetric>
            </PrimaryMetrics>
          </PrimaryCard>

          <MetricGrid>
            <MetricCard>
              <MetricLabel>고정 지출</MetricLabel>
              <MetricValue>{formatKrw(summary.fixedExpense)}</MetricValue>
              <MetricHint>매월 반복되는 지출</MetricHint>
            </MetricCard>
            <MetricCard>
              <MetricLabel>변동 지출</MetricLabel>
              <MetricValue>{formatKrw(summary.variableExpense)}</MetricValue>
              <MetricHint>일반·할부 지출</MetricHint>
            </MetricCard>
            <MetricCard>
              <MetricLabel>정산 제외</MetricLabel>
              <MetricValue>{summary.excludedCount}건</MetricValue>
              <MetricHint>{formatKrw(summary.excludedExpense)}</MetricHint>
            </MetricCard>
          </MetricGrid>

          <SettlementBreakdown
            categories={store.financeData.categories}
            ledgerType={currentLedger.type}
            members={currentMembers}
            monthNote={monthNote}
            monthNoteBusy={store.managementMutationState !== "idle"}
            paymentMethodSummary={paymentMethodSummary}
            roleAccess={roleAccess}
            summary={summary}
            trend={trend}
            trendLoading={
              store.transactionSearchStatus === "loading" ||
              store.transactionSearchRangeKey !== trendRangeKey
            }
            onMonthNoteChange={setMonthNote}
            onMonthNoteSave={() => void store.saveMonthNote(monthNote)}
            onTransactionPress={(transactionId) =>
              router.push({
                pathname: "/transactions/[id]",
                params: { id: transactionId },
              })
            }
          />
        </Content>
      </ScrollView>
    </Page>
  )
})

interface SettlementStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function SettlementState({
  actionLabel,
  message,
  onAction,
}: SettlementStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateMessage accessibilityLiveRegion="polite">{message}</StateMessage>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} tone="primary" onPress={onAction} />
        ) : null}
      </StateContent>
    </Page>
  )
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: mobileTheme.spacing[6] },
})

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
})

const Content = styled.View({
  width: "100%",
  maxWidth: 960,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const HeadingRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const HeadingCopy = styled.View({ minWidth: 0, flex: 1, gap: 4 })

const Eyebrow = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
})

const Title = styled(AppText)({
  color: mobileTheme.colors.ink,
  ...mobileTheme.typography.title,
})

const Subtitle = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  lineHeight: 18,
})

const RoleStatus = styled.View<{ $viewer: boolean }>(({ $viewer }) => ({
  alignItems: "flex-end",
  gap: 2,
  borderLeftWidth: 3,
  borderLeftColor: $viewer ? mobileTheme.colors.amber : mobileTheme.colors.teal,
  paddingLeft: mobileTheme.spacing[2],
}))

const RoleStatusLabel = styled(AppText)<{ $viewer: boolean }>(
  ({ $viewer }) => ({
    color: $viewer ? mobileTheme.colors.amber : mobileTheme.colors.teal,
    fontSize: 11,
    fontWeight: "600",
  }),
)

const RoleStatusHint = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  fontWeight: "600",
})

const StaleNotice = styled(AppText)({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.amber,
  backgroundColor: mobileTheme.colors.amberSoft,
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const FeedbackNotice = styled(AppText)<{ $error: boolean }>(({ $error }) => ({
  borderLeftWidth: 3,
  borderLeftColor: $error ? mobileTheme.colors.coral : mobileTheme.colors.teal,
  backgroundColor: $error
    ? mobileTheme.colors.coralSoft
    : mobileTheme.colors.tealSoft,
  color: $error ? mobileTheme.colors.coral : mobileTheme.colors.teal,
  padding: mobileTheme.spacing[3],
  fontSize: 11,
  lineHeight: 17,
}))

const RuleNotice = styled.View({
  gap: mobileTheme.spacing[1],
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const RuleTitle = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
})

const RuleDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
})

const PrimaryCard = styled.View({
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panel,
  paddingTop: mobileTheme.spacing[1],
  paddingBottom: mobileTheme.spacing[5],
})

const PrimaryLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
})

const PrimaryAmount = styled(AppText)({
  color: mobileTheme.colors.ink,
  ...mobileTheme.typography.display,
  letterSpacing: -0.8,
  lineHeight: 40,
})

const PrimaryDivider = styled.View({
  height: 1,
  backgroundColor: mobileTheme.colors.border,
})

const PrimaryMetrics = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[4],
})

const PrimaryMetric = styled.View({ minWidth: 0, flex: 1, gap: 4 })

const PrimaryMetricLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "700",
})

const PrimaryMetricValue = styled(AppText)<{
  $tone: "income" | "saving"
}>(({ $tone }) => ({
  color: $tone === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink,
  fontSize: 15,
  fontWeight: "600",
  lineHeight: 21,
}))

const MetricGrid = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
})

const MetricCard = styled.View({
  minWidth: 0,
  flex: 1,
  gap: 4,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[3],
})

const MetricLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  fontWeight: "700",
})

const MetricValue = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 13,
  fontWeight: "600",
  lineHeight: 19,
})

const MetricHint = styled(AppText)({
  color: mobileTheme.colors.subtle,
  fontSize: 8,
  lineHeight: 12,
})

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[4],
})

const StateMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})
