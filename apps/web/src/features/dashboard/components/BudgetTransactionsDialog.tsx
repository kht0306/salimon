"use client"

import styled from "@emotion/styled"
import {
  formatKoreanDate,
  formatKoreanTime,
  formatKrw,
  getDescendantCategoryIds,
  toDateKey,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionSplit,
} from "@salimon/types"
import { colors, radii, shadows } from "@salimon/ui-tokens"
import { X } from "lucide-react"
import { useEffect, useRef, type KeyboardEvent } from "react"
import { IconButton } from "../styles"
import { TransactionMetadataChips } from "./TransactionMetadataChips"

interface BudgetTransactionsDialogProps {
  category: Category
  categories: Category[]
  transactions: Transaction[]
  transactionSplits: TransactionSplit[]
  paymentMethods: PaymentMethod[]
  members: LedgerMember[]
  budgetAmount: number
  selectedMonth: string
  onClose: () => void
}

interface GetBudgetTransactionRowsInput {
  categoryId: string
  categories: Category[]
  transactions: Transaction[]
  transactionSplits: TransactionSplit[]
}

export interface BudgetTransactionRow {
  transaction: Transaction
  includedAmount: number
}

export function getBudgetTransactionRows({
  categoryId,
  categories,
  transactions,
  transactionSplits,
}: GetBudgetTransactionRowsInput): BudgetTransactionRow[] {
  const categoryIds = getDescendantCategoryIds(categories, categoryId)

  return transactions.flatMap((transaction) => {
    if (transaction.type !== "expense" || transaction.status !== "confirmed") {
      return []
    }

    const includedAmount = transactionAmountForCategoryIds(
      transaction,
      transactionSplits,
      categoryIds,
    )
    return includedAmount > 0 ? [{ transaction, includedAmount }] : []
  })
}

export function BudgetTransactionsDialog({
  category,
  categories,
  transactions,
  transactionSplits,
  paymentMethods,
  members,
  budgetAmount,
  selectedMonth,
  onClose,
}: BudgetTransactionsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const rows = getBudgetTransactionRows({
    categoryId: category.id,
    categories,
    transactions,
    transactionSplits,
  })
  const spentAmount = rows.reduce((sum, row) => sum + row.includedAmount, 0)
  const remainingAmount = budgetAmount - spentAmount
  const [year, month] = selectedMonth.split("-").map(Number)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose()
      return
    }
    if (event.key !== "Tab") return

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (
      event.shiftKey &&
      (document.activeElement === firstElement ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault()
      lastElement?.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === lastElement ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault()
      firstElement?.focus()
    }
  }

  return (
    <DialogBackdrop
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <DialogCard
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-transactions-title"
        aria-describedby="budget-transactions-summary"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <TitleGroup>
            <TitleLine>
              <CategoryDot $color={category.color} />
              <h2 id="budget-transactions-title">{category.name}</h2>
            </TitleLine>
            <span>
              {year}년 {month}월 · 예산 포함 거래 {rows.length}건
            </span>
          </TitleGroup>
          <CloseButton
            ref={closeButtonRef}
            type="button"
            title="닫기"
            aria-label="닫기"
            onClick={onClose}
          >
            <X size={17} />
          </CloseButton>
        </DialogHeader>

        <BudgetSummary id="budget-transactions-summary">
          <SummaryTop>
            <span>예산 사용액</span>
            <SummaryAmount>
              <strong>{formatKrw(spentAmount)}</strong>
              <span>/ {formatKrw(budgetAmount)}</span>
            </SummaryAmount>
          </SummaryTop>
          <Progress
            role="progressbar"
            aria-label={`${category.name} 예산 사용률`}
            aria-valuemin={0}
            aria-valuemax={budgetAmount}
            aria-valuenow={Math.min(spentAmount, budgetAmount)}
            aria-valuetext={`${formatKrw(spentAmount)} 사용, ${formatKrw(budgetAmount)} 예산`}
          >
            <i
              style={{
                width: `${Math.min(100, budgetAmount ? (spentAmount / budgetAmount) * 100 : 0)}%`,
                background: category.color,
              }}
            />
          </Progress>
          <Remaining $overBudget={remainingAmount < 0}>
            {remainingAmount < 0
              ? `예산보다 ${formatKrw(Math.abs(remainingAmount))} 초과`
              : `${formatKrw(remainingAmount)} 남음`}
          </Remaining>
        </BudgetSummary>

        <ListHeader>
          <strong>거래 내역</strong>
          <span>예산 반영 금액 기준</span>
        </ListHeader>
        <TransactionList>
          {rows.map(({ transaction, includedAmount }) => {
            const transactionCategory = categories.find(
              (item) => item.id === transaction.categoryId,
            )
            const splits = transactionSplits
              .filter((split) => split.transactionId === transaction.id)
              .sort((first, second) => first.sortOrder - second.sortOrder)
            const splitCategories = splits.flatMap((split) => {
              const splitCategory = categories.find(
                (item) => item.id === split.categoryId,
              )
              return splitCategory ? [splitCategory] : []
            })
            const paymentMethod = paymentMethods.find(
              (item) => item.id === transaction.paymentMethodId,
            )
            const registrant =
              members.find((member) => member.userId === transaction.createdBy)
                ?.nickname ?? "알 수 없음"
            const actor = transaction.actorUserId
              ? (members.find(
                  (member) => member.userId === transaction.actorUserId,
                )?.nickname ?? registrant)
              : "공통"

            return (
              <TransactionItem key={transaction.id}>
                <TransactionTop>
                  <TransactionMetadataChips
                    transaction={transaction}
                    category={transactionCategory}
                    categories={categories}
                    paymentMethod={paymentMethod}
                    splitCategories={splitCategories}
                  />
                  <IncludedAmount>
                    <span>예산 반영</span>
                    <strong>{formatKrw(includedAmount)}</strong>
                    {includedAmount !== transaction.amount ? (
                      <small>전체 {formatKrw(transaction.amount)}</small>
                    ) : null}
                  </IncludedAmount>
                </TransactionTop>
                <TransactionBody>
                  <strong>
                    {transaction.merchantName || transaction.memo || "거래"}
                  </strong>
                  {transaction.memo ? (
                    <span title={transaction.memo}>{transaction.memo}</span>
                  ) : null}
                </TransactionBody>
                <TransactionFooter>
                  <time dateTime={transaction.transactionAt}>
                    {formatKoreanDate(
                      toDateKey(new Date(transaction.transactionAt)),
                    )}{" "}
                    {formatKoreanTime(transaction.transactionAt)}
                  </time>
                  <span>거래 {actor}</span>
                  <span>등록 {registrant}</span>
                </TransactionFooter>
              </TransactionItem>
            )
          })}
          {rows.length === 0 ? (
            <Empty>이 예산에 반영된 확정 지출이 없습니다.</Empty>
          ) : null}
        </TransactionList>
      </DialogCard>
    </DialogBackdrop>
  )
}

const DialogBackdrop = styled.div`
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  background: rgb(15 23 42 / 56%);
  backdrop-filter: blur(2px);
  padding: 20px;

  @media (max-width: 640px) {
    place-items: end center;
    padding: 12px;
  }
`

const DialogCard = styled.div`
  width: min(680px, 100%);
  max-height: calc(100dvh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: ${shadows.floating};

  &:focus {
    outline: none;
  }

  @media (max-width: 640px) {
    max-height: calc(100dvh - 24px);
  }
`

const DialogHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid ${colors.border};
  padding: 16px 18px;
`

const TitleGroup = styled.div`
  display: grid;
  gap: 5px;

  > span {
    color: ${colors.muted};
    font-size: 11px;
  }
`

const TitleLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  h2 {
    margin: 0;
    color: ${colors.ink};
    font-size: 16px;
    font-weight: 700;
  }
`

const CategoryDot = styled.i<{ $color: string }>`
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: ${radii.round};
  background: ${({ $color }) => $color};
`

const CloseButton = styled(IconButton)`
  min-height: 32px;
  width: 32px;
`

const BudgetSummary = styled.section`
  display: grid;
  gap: 8px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
  padding: 13px 18px;
`

const SummaryTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 650;
`

const SummaryAmount = styled.div`
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-family: var(--font-geist-mono);
  white-space: nowrap;

  strong {
    color: ${colors.ink};
    font-size: 13px;
  }

  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`

const Progress = styled.div`
  height: 6px;
  overflow: hidden;
  border-radius: ${radii.xs};
  background: ${colors.border};

  i {
    display: block;
    height: 100%;
  }
`

const Remaining = styled.span<{ $overBudget: boolean }>`
  color: ${({ $overBudget }) => ($overBudget ? colors.coral : colors.muted)};
  font-size: 10px;
  font-weight: ${({ $overBudget }) => ($overBudget ? 700 : 500)};
  text-align: right;
`

const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 18px 9px;

  strong {
    color: ${colors.ink};
    font-size: 12px;
  }

  span {
    color: ${colors.muted};
    font-size: 10px;
  }
`

const TransactionList = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 10px;
`

const TransactionItem = styled.article`
  display: grid;
  gap: 8px;
  border-top: 1px solid ${colors.border};
  padding: 12px 0;
`

const TransactionTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`

const IncludedAmount = styled.div`
  flex: 0 0 auto;
  display: grid;
  justify-items: end;
  gap: 2px;
  font-family: var(--font-geist-mono);
  white-space: nowrap;

  span,
  small {
    color: ${colors.muted};
    font-size: 9px;
  }

  strong {
    color: ${colors.coral};
    font-size: 12px;
  }
`

const TransactionBody = styled.div`
  min-width: 0;

  strong,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: ${colors.ink};
    font-size: 13px;
    font-weight: 600;
  }

  span {
    margin-top: 3px;
    color: ${colors.muted};
    font-size: 11px;
  }
`

const TransactionFooter = styled.footer`
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  color: ${colors.subtle};
  font-size: 9px;

  time,
  span {
    white-space: nowrap;
  }
`

const Empty = styled.div`
  border-top: 1px solid ${colors.border};
  color: ${colors.muted};
  padding: 20px 0;
  font-size: 11px;
  text-align: center;
`
