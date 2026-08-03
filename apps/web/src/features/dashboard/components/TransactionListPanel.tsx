"use client"

import styled from "@emotion/styled"
import { getDescendantCategoryIds, toDateKey } from "@salimon/domain"
import { colors } from "@salimon/ui-tokens"
import { ListFilter } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Panel, PanelHeader, PanelTitle } from "../styles"
import { TransactionListFilters } from "./TransactionListFilters"
import { TransactionListResults } from "./TransactionListResults"
import {
  resolveRange,
  resolveTransactionRange,
  type PeriodPreset,
} from "./transactionListRange"
import { matchesPaymentMethodFilter } from "./transactionPresentation"

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
      .sort(
        (a, b) =>
          new Date(b.transactionAt).getTime() -
          new Date(a.transactionAt).getTime(),
      )
  }, [
    actorUserId,
    categoryId,
    endDate,
    keyword,
    period,
    paymentMethodIds,
    startDate,
    status,
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
