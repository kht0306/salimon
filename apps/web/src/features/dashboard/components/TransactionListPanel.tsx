"use client"

import styled from "@emotion/styled"
import { getDescendantCategoryIds, toDateKey } from "@salimon/domain"
import { colors } from "@salimon/ui-tokens"
import { ListFilter } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Panel, PanelHeader, PanelTitle, Select } from "../styles"
import { TransactionListFilters } from "./TransactionListFilters"
import { TransactionListResults } from "./TransactionListResults"
import {
  resolveRange,
  resolveTransactionRange,
  type PeriodPreset,
} from "./transactionListRange"
import {
  compareTransactions,
  matchesPaymentMethodFilter,
  type TransactionSortOrder,
} from "./transactionPresentation"

export const TransactionListPanel = observer(function TransactionListPanel() {
  const store = useAppStore()
  const [period, setPeriod] = useState<PeriodPreset>("7")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [actorUserId, setActorUserId] = useState("")
  const [paymentMethodIds, setPaymentMethodIds] = useState<string[]>([])
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [sortOrder, setSortOrder] = useState<TransactionSortOrder>("date_desc")
  function togglePaymentMethod(paymentMethodId: string) {
    setPaymentMethodIds((current) =>
      current.includes(paymentMethodId)
        ? current.filter((id) => id !== paymentMethodId)
        : [...current, paymentMethodId],
    )
  }

  function changePeriod(nextPeriod: PeriodPreset) {
    if (nextPeriod !== "custom") {
      setPeriod(nextPeriod)
      return
    }

    const previousRange = resolveRange(period, startDate, endDate)
    const fallbackRange = resolveTransactionRange(
      store.data.transactions,
      store.selectedLedgerId,
    )
    setStartDate(previousRange.start || fallbackRange.start)
    setEndDate(previousRange.end || fallbackRange.end)
    setPeriod("custom")
  }
  const transactions = useMemo(() => {
    const range = resolveRange(period, startDate, endDate)
    const query = keyword.trim().toLowerCase()
    const selectedCategoryIds = categoryId
      ? getDescendantCategoryIds(
          store.data.categories.filter(
            (category) => category.ledgerId === store.selectedLedgerId,
          ),
          categoryId,
        )
      : undefined

    return store.data.transactions
      .filter(
        (item) => item.ledgerId === store.selectedLedgerId && !item.deletedAt,
      )
      .filter((item) => {
        const date = toDateKey(new Date(item.transactionAt))
        return (
          (!range.start || date >= range.start) &&
          (!range.end || date <= range.end)
        )
      })
      .filter((item) => !type || item.type === type)
      .filter((item) => !status || item.status === status)
      .filter((item) => {
        if (!selectedCategoryIds) return true
        const splits = store.data.transactionSplits.filter(
          (split) => split.transactionId === item.id,
        )
        return splits.length > 0
          ? splits.some((split) => selectedCategoryIds.has(split.categoryId))
          : Boolean(item.categoryId && selectedCategoryIds.has(item.categoryId))
      })
      .filter((item) => matchesPaymentMethodFilter(item, paymentMethodIds))
      .filter(
        (item) =>
          !actorUserId ||
          (actorUserId === "common"
            ? !item.actorUserId
            : item.actorUserId === actorUserId),
      )
      .filter(
        (item) =>
          !query ||
          `${item.merchantName ?? ""} ${item.memo ?? ""} ${(item.tags ?? []).join(" ")}`
            .toLowerCase()
            .includes(query),
      )
      .sort((first, second) => compareTransactions(first, second, sortOrder))
  }, [
    actorUserId,
    categoryId,
    endDate,
    keyword,
    period,
    paymentMethodIds,
    startDate,
    status,
    sortOrder,
    store.data.transactions,
    store.data.transactionSplits,
    store.data.categories,
    store.selectedLedgerId,
    type,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    actorUserId,
    categoryId,
    endDate,
    keyword,
    paymentMethodIds,
    period,
    startDate,
    status,
    sortOrder,
    store.selectedLedgerId,
    type,
  ])

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <TitleIcon>
            <ListFilter size={16} /> 거래 목록
          </TitleIcon>
        </PanelTitle>
        <ResultCount>{transactions.length}건</ResultCount>
      </PanelHeader>
      <TransactionListFilters
        period={period}
        startDate={startDate}
        endDate={endDate}
        type={type}
        status={status}
        categoryId={categoryId}
        actorUserId={actorUserId}
        paymentMethodIds={paymentMethodIds}
        keyword={keyword}
        onPeriodChange={changePeriod}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onCategoryIdChange={setCategoryId}
        onActorUserIdChange={setActorUserId}
        onTogglePaymentMethod={togglePaymentMethod}
        onKeywordChange={setKeyword}
      />
      <SortControl>
        <span>거래 정렬</span>
        <Select
          aria-label="거래 정렬"
          value={sortOrder}
          onChange={(event) =>
            setSortOrder(event.target.value as TransactionSortOrder)
          }
        >
          <option value="date_desc">최신순</option>
          <option value="date_asc">과거순</option>
          <option value="amount_desc">금액 높은순</option>
          <option value="amount_asc">금액 낮은순</option>
        </Select>
      </SortControl>
      <TransactionListResults
        transactions={transactions}
        page={page}
        onPageChange={setPage}
      />
    </Panel>
  )
})

const TitleIcon = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
`
const ResultCount = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`

const SortControl = styled.label`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid ${colors.border};
  color: ${colors.muted};
  font-size: 12px;
`
