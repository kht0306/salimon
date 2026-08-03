"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import type { Dispatch, SetStateAction } from "react"
import { useAppStore } from "../StoreProvider"
import { TransactionMetadataChips } from "./TransactionMetadataChips"

const PAGE_SIZE = 50

interface TransactionListResultsProps {
  transactions: Transaction[]
  page: number
  onPageChange: Dispatch<SetStateAction<number>>
}

export const TransactionListResults = observer(function TransactionListResults({
  transactions,
  page,
  onPageChange,
}: TransactionListResultsProps) {
  const store = useAppStore()
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
    <>
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
          합계 <strong>{formatKrw(income - expense)}</strong>
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
          const splitCategories = store.data.transactionSplits
            .filter((split) => split.transactionId === transaction.id)
            .sort((first, second) => first.sortOrder - second.sortOrder)
            .flatMap((split) => {
              const splitCategory = store.data.categories.find(
                (item) => item.id === split.categoryId,
              )
              return splitCategory ? [splitCategory] : []
            })
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
                  categories={store.data.categories}
                  paymentMethod={paymentMethod}
                  splitCategories={splitCategories}
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
            onClick={() => onPageChange((value) => Math.max(1, value - 1))}
          >
            이전
          </button>
          <span>
            {currentPage} / {pageCount} · 페이지당 {PAGE_SIZE}건
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() =>
              onPageChange((value) => Math.min(pageCount, value + 1))
            }
          >
            다음
          </button>
        </Pagination>
      ) : null}
    </>
  )
})

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((item) => item.type === type && item.status === "confirmed")
    .reduce((sum, item) => sum + item.amount, 0)
}

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
