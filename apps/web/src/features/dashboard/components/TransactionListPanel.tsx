"use client"

import styled from "@emotion/styled"
import { formatKrw, toDateKey } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { ListFilter } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Field, Input, Panel, PanelHeader, PanelTitle, Select } from "../styles"
import { TransactionMetadataChips } from "./TransactionMetadataChips"
import { matchesPaymentMethodFilter } from "./transactionPresentation"

type PeriodPreset = "3" | "7" | "14" | "21" | "28" | "custom" | "all"
const PAGE_SIZE = 50

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

  const paymentMethods = store.data.paymentMethods.filter(
    (method) => method.ledgerId === store.selectedLedgerId,
  )

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
        if (!categoryId) return true
        const splits = store.data.transactionSplits.filter(
          (split) => split.transactionId === item.id,
        )
        return splits.length > 0
          ? splits.some((split) => split.categoryId === categoryId)
          : item.categoryId === categoryId
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

  const pageCount = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleTransactions = transactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const expense = sumByType(transactions, "expense")
  const income = sumByType(transactions, "income")
  const saving = sumByType(transactions, "saving")

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
      <Filters>
        <Field>
          기간
          <Select
            value={period}
            onChange={(event) =>
              changePeriod(event.target.value as PeriodPreset)
            }
          >
            <option value="3">최근 3일</option>
            <option value="7">최근 7일</option>
            <option value="14">최근 14일</option>
            <option value="21">최근 21일</option>
            <option value="28">최근 28일</option>
            <option value="all">전체</option>
            <option value="custom">직접 선택</option>
          </Select>
        </Field>
        {period === "custom" ? (
          <>
            <Field>
              시작일
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field>
              종료일
              <Input
                type="date"
                value={endDate}
                onChange={(event) => {
                  const nextEndDate = event.target.value
                  setEndDate(nextEndDate)
                  if (startDate && nextEndDate && nextEndDate < startDate) {
                    setStartDate(nextEndDate)
                  }
                }}
              />
            </Field>
          </>
        ) : null}
        <Field>
          유형
          <Select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">전체</option>
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="saving">저축</option>
          </Select>
        </Field>
        <Field>
          상태
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">전체</option>
            <option value="confirmed">확정</option>
            <option value="excluded">제외</option>
          </Select>
        </Field>
        <Field>
          카테고리
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">전체</option>
            {store.currentCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentCategoryId
                  ? `${store.currentCategories.find((item) => item.id === category.parentCategoryId)?.name ?? "상위"} › `
                  : ""}
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          행위자
          <Select
            value={actorUserId}
            onChange={(event) => setActorUserId(event.target.value)}
          >
            <option value="">전체</option>
            <option value="common">공통</option>
            {store.currentMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.nickname}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          결제수단
          <PaymentFilter>
            <summary>
              {paymentMethodIds.length === 0
                ? "전체"
                : `${paymentMethodIds.length}개 선택`}
            </summary>
            <PaymentOptions>
              <label>
                <input
                  type="checkbox"
                  checked={paymentMethodIds.includes("cash")}
                  onChange={() => togglePaymentMethod("cash")}
                />
                현금
              </label>
              {paymentMethods.map((method) => (
                <label key={method.id}>
                  <input
                    type="checkbox"
                    checked={paymentMethodIds.includes(method.id)}
                    onChange={() => togglePaymentMethod(method.id)}
                  />
                  <span>
                    {method.issuer ? `${method.issuer} · ` : ""}
                    {method.name}
                    {method.isDeleted ? " · 삭제" : ""}
                  </span>
                </label>
              ))}
            </PaymentOptions>
          </PaymentFilter>
        </Field>
        <Field>
          가맹점·메모
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="검색어"
          />
        </Field>
      </Filters>
      <Totals>
        <span>
          지출 <strong data-tone="expense">{formatKrw(expense)}</strong>
        </span>
        <span>
          수입 <strong data-tone="income">{formatKrw(income)}</strong>
        </span>
        <span>
          저축 <strong data-tone="saving">{formatKrw(saving)}</strong>
        </span>
        <span>
          정산 <strong>{formatKrw(income - expense)}</strong>
        </span>
      </Totals>
      <Rows>
        {visibleTransactions.map((transaction) => {
          const category = store.data.categories.find(
            (item) => item.id === transaction.categoryId,
          )
          const actor = transaction.actorUserId
            ? (store.currentMembers.find(
                (member) => member.userId === transaction.actorUserId,
              )?.nickname ?? "알 수 없음")
            : "공통"
          const registrant =
            store.currentMembers.find(
              (member) => member.userId === transaction.createdBy,
            )?.nickname ?? "알 수 없음"
          const paymentMethod = store.data.paymentMethods.find(
            (item) => item.id === transaction.paymentMethodId,
          )
          return (
            <Row
              key={transaction.id}
              $excluded={transaction.status === "excluded"}
            >
              <DateCell>
                {new Date(transaction.transactionAt).toLocaleString("ko-KR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </DateCell>
              <MainCell>
                <TransactionMetadataChips
                  transaction={transaction}
                  category={category}
                  paymentMethod={paymentMethod}
                  splitCount={
                    store.data.transactionSplits.filter(
                      (split) => split.transactionId === transaction.id,
                    ).length
                  }
                />
                <strong>
                  {transaction.merchantName || transaction.memo || "거래"}
                </strong>
                {transaction.merchantName && transaction.memo ? (
                  <TransactionMemo title={transaction.memo}>
                    {transaction.memo}
                  </TransactionMemo>
                ) : null}
                <small>
                  거래 {actor} · 등록 {registrant}
                </small>
              </MainCell>
              <Amount $type={transaction.type}>
                {formatKrw(transaction.amount)}
              </Amount>
            </Row>
          )
        })}
        {transactions.length === 0 ? (
          <Empty>조건에 맞는 거래가 없습니다.</Empty>
        ) : null}
      </Rows>
      {transactions.length > PAGE_SIZE ? (
        <Pagination aria-label="거래 목록 페이지">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            이전
          </button>
          <span>
            {currentPage} / {pageCount} · 페이지당 {PAGE_SIZE}건
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            다음
          </button>
        </Pagination>
      ) : null}
    </Panel>
  )
})

function resolveRange(
  period: PeriodPreset,
  startDate: string,
  endDate: string,
) {
  if (period === "all") return { start: "", end: "" }
  if (period === "custom") return { start: startDate, end: endDate }
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - Number(period) + 1)
  return { start: toDateKey(start), end: toDateKey(end) }
}

function resolveTransactionRange(
  transactions: Transaction[],
  ledgerId: string,
) {
  const dates = transactions
    .filter(
      (transaction) =>
        transaction.ledgerId === ledgerId && !transaction.deletedAt,
    )
    .map((transaction) => toDateKey(new Date(transaction.transactionAt)))
    .sort()
  const today = toDateKey(new Date())
  return {
    start: dates[0] ?? today,
    end: dates.at(-1) ?? today,
  }
}

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((item) => item.type === type && item.status === "confirmed")
    .reduce((sum, item) => sum + item.amount, 0)
}

const Filters = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`

const TitleIcon = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
`
const ResultCount = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`
const Pagination = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-top: 1px solid ${colors.border};
  padding: 12px;
  color: ${colors.muted};
  font-size: 11px;

  button {
    min-height: 32px;
    border: 1px solid ${colors.border};
    border-radius: ${radii.sm};
    background: ${colors.panel};
    color: ${colors.ink};
    padding: 0 12px;
  }

  button:disabled {
    color: ${colors.subtle};
  }
`
const PaymentFilter = styled.details`
  position: relative;

  summary {
    min-height: 38px;
    display: flex;
    align-items: center;
    border: 1px solid ${colors.border};
    border-radius: ${radii.md};
    background: ${colors.panel};
    color: ${colors.ink};
    padding: 0 12px;
    font-size: 13px;
    cursor: pointer;
    list-style-position: inside;
  }
`
const PaymentOptions = styled.div`
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  display: grid;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  padding: 6px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    border-radius: ${radii.sm};
    padding: 7px 8px;
    color: ${colors.ink};
    font-size: 12px;
    cursor: pointer;
  }

  label:hover {
    background: ${colors.panelSubtle};
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`
const Totals = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 12px 16px;
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
  span {
    color: ${colors.muted};
  }
  strong {
    margin-left: 5px;
    color: ${colors.ink};
    font-family: var(--font-geist-mono);
  }
  strong[data-tone="expense"] {
    color: ${colors.coral};
  }
  strong[data-tone="income"] {
    color: ${colors.green};
  }
  strong[data-tone="saving"] {
    color: ${colors.violet};
  }
`
const Rows = styled.div`
  display: grid;
  gap: 8px;
  padding: 12px;
`
const Row = styled.article<{ $excluded: boolean }>`
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  opacity: ${({ $excluded }) => ($excluded ? 0.52 : 1)};
  @media (max-width: 680px) {
    grid-template-columns: 1fr auto;
  }
`
const DateCell = styled.time`
  color: ${colors.muted};
  font-family: var(--font-geist-mono);
  font-size: 11px;

  @media (max-width: 680px) {
    grid-column: 1 / -1;
  }
`
const MainCell = styled.div`
  min-width: 0;
  display: grid;
  gap: 5px;
  > strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  > small {
    color: ${colors.muted};
    font-size: 11px;
    color: ${colors.teal};
  }
`
const TransactionMemo = styled.span`
  overflow: hidden;
  color: ${colors.muted};
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const Amount = styled.strong<{ $type: Transaction["type"] }>`
  color: ${({ $type }) =>
    $type === "income"
      ? colors.green
      : $type === "expense"
        ? colors.coral
        : $type === "saving"
          ? colors.violet
          : colors.blue};
  font-family: var(--font-geist-mono);
  font-size: 12px;
`
const Empty = styled.div`
  padding: 30px;
  text-align: center;
  color: ${colors.muted};
  font-size: 13px;
  border-radius: ${radii.md};
`
