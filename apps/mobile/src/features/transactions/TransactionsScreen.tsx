import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { Category, LedgerMember, Transaction } from "@salimon/types"
import { router } from "expo-router"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  type SectionListRenderItemInfo,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
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
  categories: Category[]
  filters: MobileTransactionFilters
  filtersOpen: boolean
  isStale: boolean
  keyword: string
  ledgerName: string
  members: LedgerMember[]
  resultCount: number
  totals: ReturnType<typeof calculateTransactionTotals>
  onFilterChange: (filters: MobileTransactionFilters) => void
  onFilterReset: () => void
  onKeywordChange: (keyword: string) => void
  onToggleFilters: () => void
}

function TransactionListHeader({
  activeFilterCount,
  categories,
  filters,
  filtersOpen,
  isStale,
  keyword,
  ledgerName,
  members,
  resultCount,
  totals,
  onFilterChange,
  onFilterReset,
  onKeywordChange,
  onToggleFilters,
}: TransactionListHeaderProps) {
  return (
    <Header>
      <HeadingRow>
        <HeadingCopy>
          <Eyebrow>{ledgerName}</Eyebrow>
          <Title accessibilityRole="header">거래 내역</Title>
          <Subtitle>이번 달 거래를 조건별로 빠르게 찾아보세요.</Subtitle>
        </HeadingCopy>
        <ResultCount>{resultCount}건</ResultCount>
      </HeadingRow>

      <LedgerMonthControls />

      {isStale ? (
        <StaleNotice accessibilityLiveRegion="polite">
          마지막으로 불러온 거래를 읽기 전용으로 표시하고 있습니다.
        </StaleNotice>
      ) : null}

      <SearchRow>
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
        <FilterButton
          $active={filtersOpen || activeFilterCount > 0}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={onToggleFilters}
        >
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

      <TotalsCard accessibilityLabel="검색 결과 합계">
        <TotalItem>
          <TotalLabel>지출</TotalLabel>
          <TotalValue $tone="expense">{formatKrw(totals.expense)}</TotalValue>
        </TotalItem>
        <TotalItem>
          <TotalLabel>수입</TotalLabel>
          <TotalValue $tone="income">{formatKrw(totals.income)}</TotalValue>
        </TotalItem>
        <TotalItem>
          <TotalLabel>저축</TotalLabel>
          <TotalValue $tone="saving">{formatKrw(totals.saving)}</TotalValue>
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
    Boolean(filters.categoryId),
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
  padding: mobileTheme.spacing[5],
})

const StateMessage = styled.Text({
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

const Eyebrow = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})

const Title = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 24,
  fontWeight: "900",
  lineHeight: 31,
})

const Subtitle = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  lineHeight: 18,
})

const ResultCount = styled.Text({
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[3],
})

const StaleNotice = styled.Text({
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

const SearchInput = styled.TextInput({
  minWidth: 0,
  minHeight: 46,
  flex: 1,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.ink,
  fontSize: 13,
  paddingHorizontal: mobileTheme.spacing[4],
})

const FilterButton = styled.Pressable<{ $active: boolean }>(({ $active }) => ({
  minWidth: 76,
  minHeight: 46,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: $active ? mobileTheme.colors.teal : mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: $active
    ? mobileTheme.colors.tealSoft
    : mobileTheme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[3],
}))

const FilterButtonLabel = styled.Text<{ $active: boolean }>(({ $active }) => ({
  color: $active ? mobileTheme.colors.teal : mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "800",
}))

const TotalsCard = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.ink,
  padding: mobileTheme.spacing[4],
})

const TotalItem = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const TotalLabel = styled.Text({
  color: mobileTheme.colors.subtle,
  fontSize: 9,
  fontWeight: "700",
})

const TotalValue = styled.Text<{
  $tone: "expense" | "income" | "saving"
}>(({ $tone }) => ({
  color:
    $tone === "income"
      ? "#93c5fd"
      : $tone === "expense"
        ? "#fcd34d"
        : "#c4b5fd",
  fontSize: 11,
  fontWeight: "900",
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

const DateTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "900",
})

const DateCount = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "600",
})

const DateExpense = styled.Text({
  color: mobileTheme.colors.amber,
  fontSize: 11,
  fontWeight: "800",
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

const EmptyTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "800",
})

const EmptyDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  textAlign: "center",
})
