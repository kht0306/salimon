"use client"

import styled from "@emotion/styled"
import { formatKrw, toDateKey } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { ListFilter } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Field, Input, Panel, PanelHeader, PanelTitle, Select } from "../styles"

type PeriodPreset = "3" | "7" | "14" | "21" | "28" | "custom" | "all"

const typeLabels: Record<Transaction["type"], string> = {
  expense: "지출",
  income: "수입",
  transfer: "이체",
}
const statusLabels: Record<Transaction["status"], string> = {
  pending: "대기",
  confirmed: "확정",
  excluded: "제외",
}

export const TransactionListPanel = observer(function TransactionListPanel() {
  const store = useAppStore()
  const [period, setPeriod] = useState<PeriodPreset>("7")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [actorUserId, setActorUserId] = useState("")
  const [keyword, setKeyword] = useState("")

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
      .filter((item) => !categoryId || item.categoryId === categoryId)
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
          `${item.merchantName ?? ""} ${item.memo ?? ""}`
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
    startDate,
    status,
    store.data.transactions,
    store.selectedLedgerId,
    type,
  ])

  const expense = sumByType(transactions, "expense")
  const income = sumByType(transactions, "income")

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
            <option value="common">공통</option>
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="transfer">이체</option>
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
            <option value="pending">대기</option>
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
            {store.currentMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.nickname}
              </option>
            ))}
          </Select>
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
          지출 <strong data-tone="expense">-{formatKrw(expense)}</strong>
        </span>
        <span>
          수입 <strong data-tone="income">+{formatKrw(income)}</strong>
        </span>
        <span>
          정산 <strong>{formatKrw(income - expense)}</strong>
        </span>
      </Totals>
      <Rows>
        {transactions.map((transaction) => {
          const category =
            store.data.categories.find(
              (item) => item.id === transaction.categoryId,
            )?.name ?? "기타"
          const actor = transaction.actorUserId
            ? (store.currentMembers.find(
                (member) => member.userId === transaction.actorUserId,
              )?.nickname ?? "알 수 없음")
            : "공통"
          const registrant =
            store.currentMembers.find(
              (member) => member.userId === transaction.createdBy,
            )?.nickname ?? "알 수 없음"
          return (
            <Row key={transaction.id}>
              <DateCell>
                {new Date(transaction.transactionAt).toLocaleString("ko-KR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </DateCell>
              <MainCell>
                <strong>
                  {transaction.merchantName || transaction.memo || "거래"}
                </strong>
                <span>
                  {typeLabels[transaction.type]} · {category} ·{" "}
                  {statusLabels[transaction.status]}
                  {transaction.recurringType === "fixed" ? " · 고정비" : ""}
                  {transaction.recurringType === "installment"
                    ? ` · (${transaction.installmentNumber}/${transaction.installmentTotal}개월)`
                    : ""}
                </span>
                <small>
                  행위자 {actor} · 등록자 {registrant}
                </small>
              </MainCell>
              <Amount $type={transaction.type}>
                {transaction.type === "income"
                  ? "+"
                  : transaction.type === "expense"
                    ? "-"
                    : ""}
                {formatKrw(transaction.amount)}
              </Amount>
            </Row>
          )
        })}
        {transactions.length === 0 ? (
          <Empty>조건에 맞는 거래가 없습니다.</Empty>
        ) : null}
      </Rows>
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
    .filter((item) => item.type === type && item.status !== "excluded")
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
`
const Rows = styled.div`
  display: grid;
`
const Row = styled.article`
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 13px 16px;
  border-bottom: 1px solid ${colors.border};
  @media (max-width: 680px) {
    grid-template-columns: 1fr auto;
  }
`
const DateCell = styled.time`
  color: ${colors.muted};
  font-family: var(--font-geist-mono);
  font-size: 11px;
`
const MainCell = styled.div`
  min-width: 0;
  display: grid;
  gap: 2px;
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  span,
  small {
    color: ${colors.muted};
    font-size: 11px;
  }
  small {
    color: ${colors.teal};
  }
`
const Amount = styled.strong<{ $type: Transaction["type"] }>`
  color: ${({ $type }) =>
    $type === "income"
      ? colors.green
      : $type === "expense"
        ? colors.coral
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
