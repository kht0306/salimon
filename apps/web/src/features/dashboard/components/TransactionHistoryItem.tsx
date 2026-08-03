"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import { CircleStop, Copy, Pencil, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { IconButton } from "../styles"
import { TransactionMetadataChips } from "./TransactionMetadataChips"
import { canCopyTransaction } from "./transactionEditorDraft"

interface TransactionHistoryItemProps {
  transaction: Transaction
  isDeletingInstallment: boolean
  onCopy: (transaction: Transaction) => void
  onEdit: (transaction: Transaction) => void
  onEndInstallment: (transaction: Transaction) => void
  onOpenInstallmentDelete: (transaction: Transaction) => void
}

export const TransactionHistoryItem = observer(function TransactionHistoryItem({
  transaction,
  isDeletingInstallment,
  onCopy,
  onEdit,
  onEndInstallment,
  onOpenInstallmentDelete,
}: TransactionHistoryItemProps) {
  const store = useAppStore()
  const category = store.data.categories.find(
    (item) => item.id === transaction.categoryId,
  )
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
  const registrant =
    store.currentMembers.find(
      (member) => member.userId === transaction.createdBy,
    )?.nickname ?? "알 수 없음"
  const actor = transaction.actorUserId
    ? (store.currentMembers.find(
        (member) => member.userId === transaction.actorUserId,
      )?.nickname ?? registrant)
    : "공통"

  return (
    <Item $excluded={transaction.status === "excluded"}>
      <TransactionTop>
        <TransactionMetadataChips
          transaction={transaction}
          category={category}
          categories={store.data.categories}
          paymentMethod={paymentMethod}
          splitCategories={splitCategories}
        />
        <Amount $type={transaction.type}>
          {formatKrw(transaction.amount)}
        </Amount>
      </TransactionTop>
      <TransactionBody>
        <TransactionName>
          {transaction.merchantName || transaction.memo || "거래"}
        </TransactionName>
        {transaction.memo ? (
          <TransactionMemo title={transaction.memo}>
            {transaction.memo}
          </TransactionMemo>
        ) : null}
      </TransactionBody>
      <TransactionFooter>
        <AuditInfo>
          <span>거래 {actor}</span>
          <span>등록 {registrant}</span>
          <time dateTime={transaction.createdAt}>
            {new Date(transaction.createdAt).toLocaleString("ko-KR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        </AuditInfo>
        <ActionCluster>
          {canCopyTransaction(transaction) ? (
            <CompactAction
              title="복사하여 신규 등록"
              onClick={() => onCopy(transaction)}
            >
              <Copy size={14} />
            </CompactAction>
          ) : null}
          <CompactAction title="수정" onClick={() => onEdit(transaction)}>
            <Pencil size={14} />
          </CompactAction>
          {transaction.recurringType === "fixed" &&
          transaction.recurringRuleId ? (
            <CompactAction
              title="이번 달까지만 유지하고 반복 종료"
              aria-label="이번 달까지만 유지하고 반복 종료"
              onClick={() =>
                void store.endFixedRule(transaction.recurringRuleId!, "next")
              }
            >
              <CircleStop size={14} />
            </CompactAction>
          ) : null}
          {transaction.recurringType === "installment" &&
          transaction.recurringRuleId &&
          (transaction.installmentNumber ?? 0) <
            (transaction.installmentTotal ?? 0) ? (
            <CompactAction
              title="이 회차까지만 유지하고 할부 종료"
              aria-label="이 회차까지만 유지하고 할부 종료"
              disabled={isDeletingInstallment}
              onClick={() => {
                if (
                  window.confirm(
                    "선택한 회차는 유지하고 다음 회차부터 할부를 종료할까요?",
                  )
                ) {
                  onEndInstallment(transaction)
                }
              }}
            >
              <CircleStop size={14} />
            </CompactAction>
          ) : null}
          <CompactAction
            $variant="danger"
            aria-label={
              transaction.recurringType === "fixed"
                ? "이번 달부터 고정 거래와 반복 종료"
                : transaction.recurringType === "installment"
                  ? "할부 삭제 범위 선택"
                  : "삭제"
            }
            title={
              transaction.recurringType === "fixed"
                ? "이번 달부터 고정 거래와 반복 종료"
                : transaction.recurringType === "installment"
                  ? "할부 삭제 범위 선택"
                  : "삭제"
            }
            disabled={isDeletingInstallment}
            onClick={() => {
              if (
                transaction.recurringType === "fixed" &&
                transaction.recurringRuleId
              ) {
                if (
                  window.confirm(
                    "이번 달 거래와 이후 반복 거래를 모두 종료할까요?",
                  )
                ) {
                  void store.endFixedRule(
                    transaction.recurringRuleId,
                    "current",
                  )
                }
                return
              }
              if (
                transaction.recurringType === "installment" &&
                transaction.recurringRuleId &&
                transaction.installmentNumber
              ) {
                onOpenInstallmentDelete(transaction)
                return
              }
              void store.softDeleteTransaction(transaction.id)
            }}
          >
            <Trash2 size={14} />
          </CompactAction>
        </ActionCluster>
      </TransactionFooter>
    </Item>
  )
})

const Item = styled.article<{ $excluded: boolean }>`
  display: grid;
  gap: 9px;
  min-height: 126px;
  border-bottom: 1px solid ${colors.border};
  padding: 12px 0;
  opacity: ${({ $excluded }) => ($excluded ? 0.52 : 1)};

  &:hover > footer > div:last-of-type,
  &:focus-within > footer > div:last-of-type {
    opacity: 1;
  }
`

const TransactionTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`

const TransactionBody = styled.div`
  min-width: 0;
`

const TransactionName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
`

const TransactionMemo = styled.div`
  margin-top: 4px;
  color: ${colors.muted};
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Amount = styled.div<{ $type: Transaction["type"] }>`
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
  font-weight: 650;
  white-space: nowrap;
`

const TransactionFooter = styled.footer`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
`

const AuditInfo = styled.div`
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  color: ${colors.subtle};
  font-size: 9px;

  span,
  time {
    white-space: nowrap;
  }
`

const ActionCluster = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 140ms ease;

  @media (hover: none) {
    opacity: 1;
  }
`

const CompactAction = styled(IconButton)`
  width: 28px;
  min-height: 28px;
  border-color: ${colors.border};
`
