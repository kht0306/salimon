import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { Category, LedgerMember, Transaction } from "@salimon/types"
import { router } from "expo-router"
import { Plus, Search, SlidersHorizontal } from "lucide-react-native"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  type SectionListRenderItemInfo,
  useWindowDimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { LedgerMonthControls } from "../dashboard/LedgerMonthControls"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { TransactionFilterPanel } from "./TransactionFilterPanel"
import { TransactionListRow } from "./TransactionListRow"
import { TransactionsSkeleton } from "./TransactionsSkeleton"
import {
  calculateTransactionTotals,
  defaultTransactionFilters,
  filterTransactions,
  groupTransactionsByDate,
  type MobileTransactionFilters,
  type TransactionDateSection,
} from "./transactionPresentation"

const safeAreaEdges = ["top"] as const

export const TransactionsScreen = observer(function TransactionsScreen() {
  const store = useMobileAppStore()
  const [filters, setFilters] = useState<MobileTransactionFilters>(() => ({
    ...defaultTransactionFilters,
  }))
  const [filtersOpen, setFiltersOpen] = useState(false)

  const categories = useMemo(
    () =>
      store.financeData.categories.filter(
        (category) => category.ledgerId === store.selectedLedgerId,
      ),
    [store.financeData.categories, store.selectedLedgerId],
  )
  const members = useMemo(
    () =>
      store.financeData.members.filter(
        (member) =>
          member.ledgerId === store.selectedLedgerId &&
          member.status === "active",
      ),
    [store.financeData.members, store.selectedLedgerId],
  )
  const filteredTransactions = useMemo(
    () =>
      filterTransactions(store.monthTransactions, filters, {
        categories,
        selectedMonth: store.selectedMonth,
        transactionSplits: store.financeData.transactionSplits,
      }),
    [
      categories,
      filters,
      store.financeData.transactionSplits,
      store.monthTransactions,
      store.selectedMonth,
    ],
  )
  const splitCountByTransaction = useMemo(() => {
    const counts = new Map<string, number>()
    for (const split of store.financeData.transactionSplits) {
      counts.set(
        split.transactionId,
        (counts.get(split.transactionId) ?? 0) + 1,
      )
    }
    return counts
  }, [store.financeData.transactionSplits])
  const sections = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  )
  const totals = useMemo(
    () => calculateTransactionTotals(filteredTransactions),
    [filteredTransactions],
  )
  const activeFilterCount = countActiveFilters(filters)

  useEffect(() => {
    setFilters({ ...defaultTransactionFilters })
    setFiltersOpen(false)
  }, [store.selectedLedgerId, store.selectedMonth])

  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return (
      <Page edges={safeAreaEdges}>
        <TransactionsSkeleton />
      </Page>
    )
  }
  if (store.dataStatus === "error") {
    return (
      <TransactionsState
        actionLabel="다시 불러오기"
        message={store.dataErrorMessage ?? "거래 내역을 불러오지 못했습니다."}
        onAction={() => void store.refreshSelectedMonth()}
      />
    )
  }

  function openTransaction(transactionId: string): void {
    router.push({
      pathname: "/transactions/[id]",
      params: { id: transactionId },
    })
  }

  function renderTransaction({
    item,
  }: SectionListRenderItemInfo<Transaction, TransactionDateSection>) {
    return (
      <TransactionListRow
        categories={categories}
        members={members}
        splitCount={splitCountByTransaction.get(item.id) ?? 0}
        transaction={item}
        onPress={() => openTransaction(item.id)}
      />
    )
  }

  return (
    <Page edges={safeAreaEdges}>
      <SectionList<Transaction, TransactionDateSection>
        contentContainerStyle={styles.listContent}
        initialNumToRender={18}
        keyExtractor={(transaction) => transaction.id}
        ListEmptyComponent={
          <EmptyState>
            <EmptyTitle>조건에 맞는 거래가 없습니다.</EmptyTitle>
            <EmptyDescription>
              필터를 초기화하거나 다른 월과 가계부를 선택해 주세요.
            </EmptyDescription>
          </EmptyState>
        }
        ListHeaderComponent={
          <TransactionListHeader
            activeFilterCount={activeFilterCount}
            canCreate={store.canMutateCurrentLedger}
            categories={categories}
            filters={filters}
            filtersOpen={filtersOpen}
            isStale={store.dataStatus === "stale"}
            keyword={filters.keyword}
            ledgerName={store.currentLedgerName}
            members={members}
            resultCount={filteredTransactions.length}
            totals={totals}
            onFilterChange={setFilters}
            onFilterReset={() => setFilters({ ...defaultTransactionFilters })}
            onKeywordChange={(keyword) =>
              setFilters((current) => ({ ...current, keyword }))
            }
            onCreate={() => router.push("/transactions/new")}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
          />
        }
        maxToRenderPerBatch={20}
        refreshControl={
          <RefreshControl
            colors={[mobileTheme.colors.teal]}
            refreshing={store.dataStatus === "refreshing"}
            tintColor={mobileTheme.colors.teal}
            onRefresh={() => void store.refreshSelectedMonth()}
          />
        }
        renderItem={renderTransaction}
        renderSectionHeader={({ section }) => (
          <DateHeader>
            <DateHeaderCopy>
              <DateTitle>{section.title}</DateTitle>
              <DateCount>{section.data.length}건</DateCount>
            </DateHeaderCopy>
            <DateExpense>
              {section.expense > 0 ? formatKrw(section.expense) : "—"}
            </DateExpense>
          </DateHeader>
        )}
        sections={sections}
        stickySectionHeadersEnabled
        windowSize={9}
      />
    </Page>
  )
})

interface TransactionListHeaderProps {
  activeFilterCount: number
  canCreate: boolean
  categories: Category[]
  filters: MobileTransactionFilters
  filtersOpen: boolean
  isStale: boolean
  keyword: string
  ledgerName: string
  members: LedgerMember[]
  resultCount: number
  totals: ReturnType<typeof calculateTransactionTotals>
  onCreate: () => void
  onFilterChange: (filters: MobileTransactionFilters) => void
  onFilterReset: () => void
  onKeywordChange: (keyword: string) => void
  onToggleFilters: () => void
}

function TransactionListHeader({
  activeFilterCount,
  canCreate,
  categories,
  filters,
  filtersOpen,
  isStale,
  keyword,
  ledgerName,
  members,
  resultCount,
  totals,
  onCreate,
  onFilterChange,
  onFilterReset,
  onKeywordChange,
  onToggleFilters,
}: TransactionListHeaderProps) {
  const { fontScale, width } = useWindowDimensions()
  const stackTotals = fontScale >= 1.3 || width < 360

  return (
    <Header>
      <HeadingRow>
        <HeadingCopy>
          <Eyebrow>{ledgerName}</Eyebrow>
          <Title accessibilityRole="header">거래 내역</Title>
          <Subtitle>이번 달 거래를 조건별로 빠르게 찾아보세요.</Subtitle>
        </HeadingCopy>
        <HeadingActions>
          <ResultCount>{resultCount}건</ResultCount>
          {canCreate ? (
            <CreateButton accessibilityRole="button" onPress={onCreate}>
              <Plus
                color={mobileTheme.colors.panel}
                size={16}
                strokeWidth={2}
              />
              <CreateButtonLabel>거래 추가</CreateButtonLabel>
            </CreateButton>
          ) : null}
        </HeadingActions>
      </HeadingRow>

      <LedgerMonthControls />

      {isStale ? (
        <StaleNotice accessibilityLiveRegion="polite">
          마지막으로 불러온 거래를 읽기 전용으로 표시하고 있습니다.
        </StaleNotice>
      ) : null}

      <SearchRow>
        <SearchField>
          <Search
            color={mobileTheme.colors.muted}
            size={17}
            strokeWidth={1.8}
          />
          <SearchInput
            accessibilityLabel="가맹점 메모 태그 검색"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="가맹점, 메모, 태그 검색"
            placeholderTextColor={mobileTheme.colors.subtle}
            returnKeyType="search"
            value={keyword}
            onChangeText={onKeywordChange}
          />
        </SearchField>
        <FilterButton
          $active={filtersOpen || activeFilterCount > 0}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={onToggleFilters}
        >
          <SlidersHorizontal
            color={
              filtersOpen || activeFilterCount > 0
                ? mobileTheme.colors.teal
                : mobileTheme.colors.ink
            }
            size={16}
            strokeWidth={1.8}
          />
          <FilterButtonLabel $active={filtersOpen || activeFilterCount > 0}>
            필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
          </FilterButtonLabel>
        </FilterButton>
      </SearchRow>

      {filtersOpen ? (
        <TransactionFilterPanel
          categories={categories}
          filters={filters}
          members={members}
          onChange={onFilterChange}
          onReset={onFilterReset}
        />
      ) : null}

      <TotalsCard $stacked={stackTotals} accessibilityLabel="검색 결과 합계">
        <TotalItem $divided={false} $stacked={stackTotals}>
          <TotalLabel>지출</TotalLabel>
          <TotalValue $tone="expense" numberOfLines={1}>
            {formatKrw(totals.expense)}
          </TotalValue>
        </TotalItem>
        <TotalItem $divided $stacked={stackTotals}>
          <TotalLabel>수입</TotalLabel>
          <TotalValue $tone="income" numberOfLines={1}>
            {formatKrw(totals.income)}
          </TotalValue>
        </TotalItem>
        <TotalItem $divided $stacked={stackTotals}>
          <TotalLabel>저축</TotalLabel>
          <TotalValue $tone="saving" numberOfLines={1}>
            {formatKrw(totals.saving)}
          </TotalValue>
        </TotalItem>
      </TotalsCard>
    </Header>
  )
}

function countActiveFilters(filters: MobileTransactionFilters): number {
  return [
    filters.period !== "all",
    Boolean(filters.type),
    Boolean(filters.status),
    Boolean(filters.structure),
    filters.categoryIds.length > 0,
    Boolean(filters.actorUserId),
    Boolean(filters.keyword.trim()),
  ].filter(Boolean).length
}

interface TransactionsStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function TransactionsState({
  actionLabel,
  message,
  onAction,
}: TransactionsStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateMessage accessibilityLiveRegion="polite">{message}</StateMessage>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} onPress={onAction} tone="primary" />
        ) : null}
      </StateContent>
    </Page>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: mobileTheme.spacing[6] },
})

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
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
  fontSize: 15,
  lineHeight: 23,
  textAlign: "center",
})

const Header = styled.View({
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const HeadingRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const HeadingCopy = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

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

const ResultCount = styled(AppText)({
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[3],
})

const HeadingActions = styled.View({
  alignItems: "flex-end",
  gap: mobileTheme.spacing[2],
})

const CreateButton = styled.Pressable({
  minHeight: mobileTheme.controls.touch,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: mobileTheme.spacing[1],
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.teal,
  paddingHorizontal: mobileTheme.spacing[3],
})

const CreateButtonLabel = styled(AppText)({
  color: mobileTheme.colors.panel,
  fontSize: 11,
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

const SearchRow = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const SearchField = styled.View({
  minWidth: 0,
  minHeight: 46,
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[3],
})

const SearchInput = styled.TextInput({
  minWidth: 0,
  minHeight: 44,
  flex: 1,
  color: mobileTheme.colors.ink,
  fontFamily: "Pretendard",
  fontSize: 13,
  paddingVertical: 0,
})

const FilterButton = styled.Pressable<{ $active: boolean }>(({ $active }) => ({
  minWidth: 76,
  minHeight: 46,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: mobileTheme.spacing[1],
  borderWidth: 1,
  borderColor: $active ? mobileTheme.colors.teal : mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: $active
    ? mobileTheme.colors.tealSoft
    : mobileTheme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[3],
}))

const FilterButtonLabel = styled(AppText)<{ $active: boolean }>(
  ({ $active }) => ({
    color: $active ? mobileTheme.colors.teal : mobileTheme.colors.ink,
    fontSize: 12,
    fontWeight: "600",
  }),
)

const TotalsCard = styled.View<{ $stacked: boolean }>(({ $stacked }) => ({
  flexDirection: $stacked ? "column" : "row",
  borderTopWidth: 1,
  borderTopColor: mobileTheme.colors.border,
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panel,
}))

const TotalItem = styled.View<{ $divided: boolean; $stacked: boolean }>(
  ({ $divided, $stacked }) => ({
    minWidth: 0,
    flex: $stacked ? undefined : 1,
    flexDirection: $stacked ? "row" : "column",
    alignItems: $stacked ? "baseline" : "center",
    justifyContent: $stacked ? "space-between" : "flex-start",
    gap: mobileTheme.spacing[1],
    borderTopWidth: $stacked && $divided ? 1 : 0,
    borderTopColor: mobileTheme.colors.border,
    borderLeftWidth: !$stacked && $divided ? 1 : 0,
    borderLeftColor: mobileTheme.colors.border,
    paddingVertical: mobileTheme.spacing[3],
    paddingHorizontal: mobileTheme.spacing[2],
  }),
)

const TotalLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  fontWeight: "700",
})

const TotalValue = styled(AppText)<{
  $tone: "expense" | "income" | "saving"
}>(({ $tone }) => ({
  color: $tone === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
  lineHeight: 17,
}))

const DateHeader = styled.View({
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.canvas,
  paddingHorizontal: mobileTheme.spacing[4],
})

const DateHeaderCopy = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  gap: mobileTheme.spacing[2],
})

const DateTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "600",
})

const DateCount = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "600",
})

const DateExpense = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
})

const EmptyState = styled.View({
  alignItems: "center",
  gap: mobileTheme.spacing[2],
  marginHorizontal: mobileTheme.spacing[4],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[6],
})

const EmptyTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "600",
})

const EmptyDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  textAlign: "center",
})
