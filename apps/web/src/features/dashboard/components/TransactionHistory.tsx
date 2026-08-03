"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { InstallmentDeleteScope, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Check,
  ChevronDown,
  CircleStop,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { IconButton } from "../styles"
import { InstallmentDeleteDialog } from "./InstallmentDeleteDialog"
import { TransactionMetadataChips } from "./TransactionMetadataChips"
import { canCopyTransaction } from "./transactionEditorDraft"
import {
  groupTransactionsByActor,
  groupTransactionsByRecurrence,
  groupTransactionsByRegistrant,
} from "./transactionPresentation"

interface TransactionHistoryProps {
  onCopy: (transaction: Transaction) => void
  onEdit: (transaction: Transaction) => void
}

export const TransactionHistory = observer(function TransactionHistory({
  onCopy,
  onEdit,
}: TransactionHistoryProps) {
  const store = useAppStore()
  const [deletingInstallment, setDeletingInstallment] =
    useState<Transaction | null>(null)
  const [isDeletingInstallment, setDeletingInstallmentBusy] = useState(false)
  const deletingInstallmentSeries = deletingInstallment?.recurringRuleId
    ? store.data.transactions.filter(
        (transaction) =>
          transaction.recurringRuleId === deletingInstallment.recurringRuleId,
      )
    : []
  const recurrenceGroups = groupTransactionsByRecurrence(
    store.calendarSelectedDateTransactions,
  ).map((recurrenceGroup) => ({
    ...recurrenceGroup,
    userGroups:
      store.transactionGrouping === "actor"
        ? groupTransactionsByActor(
            recurrenceGroup.transactions,
            store.currentMembers,
          )
        : store.transactionGrouping === "registrant"
          ? groupTransactionsByRegistrant(
              recurrenceGroup.transactions,
              store.currentMembers,
            )
          : [
              {
                key: "all",
                label: "",
                transactions: recurrenceGroup.transactions,
              },
            ],
  }))

  async function deleteInstallment(
    transaction: Transaction,
    scope: InstallmentDeleteScope,
  ) {
    if (
      isDeletingInstallment ||
      !transaction.recurringRuleId ||
      !transaction.installmentNumber
    ) {
      return
    }

    setDeletingInstallmentBusy(true)
    try {
      const deleted = await store.deleteInstallmentOccurrences(
        transaction.recurringRuleId,
        transaction.installmentNumber,
        scope,
      )
      if (deleted) setDeletingInstallment(null)
    } finally {
      setDeletingInstallmentBusy(false)
    }
  }

  return (
    <>
      <TransactionList>
        {recurrenceGroups.map((recurrenceGroup) => (
          <TransactionGroup key={recurrenceGroup.key}>
            <RecurrenceGroupHeader
              type="button"
              $recurring={recurrenceGroup.key === "recurring"}
              $collapsed={store.collapsedTransactionGroupKeys.has(
                recurrenceGroup.key,
              )}
              aria-expanded={
                !store.collapsedTransactionGroupKeys.has(recurrenceGroup.key)
              }
              onClick={() => store.toggleTransactionGroup(recurrenceGroup.key)}
            >
              <span>{recurrenceGroup.label}</span>
              <GroupHeaderMeta>
                <small>{recurrenceGroup.transactions.length}건</small>
                <ChevronDown size={14} aria-hidden="true" />
              </GroupHeaderMeta>
            </RecurrenceGroupHeader>
            {!store.collapsedTransactionGroupKeys.has(recurrenceGroup.key)
              ? recurrenceGroup.userGroups.map((group) => (
                  <UserGroup key={`${recurrenceGroup.key}-${group.key}`}>
                    {store.transactionGrouping !== "none" ? (
                      <TransactionGroupHeader>
                        <span>{group.label}</span>
                        <small>{group.transactions.length}건</small>
                      </TransactionGroupHeader>
                    ) : null}
                    {group.transactions.map((transaction) => {
                      const category = store.data.categories.find(
                        (item) => item.id === transaction.categoryId,
                      )
                      const paymentMethod = store.data.paymentMethods.find(
                        (item) => item.id === transaction.paymentMethodId,
                      )
                      const splitCategories = store.data.transactionSplits
                        .filter(
                          (split) => split.transactionId === transaction.id,
                        )
                        .sort(
                          (first, second) => first.sortOrder - second.sortOrder,
                        )
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
                            (member) =>
                              member.userId === transaction.actorUserId,
                          )?.nickname ?? registrant)
                        : "공통"
                      return (
                        <TransactionItem
                          key={transaction.id}
                          $excluded={transaction.status === "excluded"}
                        >
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
                              {transaction.merchantName ||
                                transaction.memo ||
                                "거래"}
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
                                {new Date(transaction.createdAt).toLocaleString(
                                  "ko-KR",
                                  {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  },
                                )}
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
                              <CompactAction
                                title="수정"
                                onClick={() => onEdit(transaction)}
                              >
                                <Pencil size={14} />
                              </CompactAction>
                              {transaction.recurringType === "fixed" &&
                              transaction.recurringRuleId ? (
                                <CompactAction
                                  title="이번 달까지만 유지하고 반복 종료"
                                  aria-label="이번 달까지만 유지하고 반복 종료"
                                  onClick={() =>
                                    void store.endFixedRule(
                                      transaction.recurringRuleId!,
                                      "next",
                                    )
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
                                      void deleteInstallment(
                                        transaction,
                                        "future",
                                      )
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
                                    : transaction.recurringType ===
                                        "installment"
                                      ? "할부 삭제 범위 선택"
                                      : "삭제"
                                }
                                title={
                                  transaction.recurringType === "fixed"
                                    ? "이번 달부터 고정 거래와 반복 종료"
                                    : transaction.recurringType ===
                                        "installment"
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
                                    transaction.recurringType ===
                                      "installment" &&
                                    transaction.recurringRuleId &&
                                    transaction.installmentNumber
                                  ) {
                                    setDeletingInstallment(transaction)
                                    return
                                  }
                                  void store.softDeleteTransaction(
                                    transaction.id,
                                  )
                                }}
                              >
                                <Trash2 size={14} />
                              </CompactAction>
                            </ActionCluster>
                          </TransactionFooter>
                        </TransactionItem>
                      )
                    })}
                  </UserGroup>
                ))
              : null}
          </TransactionGroup>
        ))}
      </TransactionList>

      {store.calendarSelectedDateTransactions.length === 0 ? (
        <Empty>
          <Check size={20} />
          <span>등록된 거래 없음</span>
        </Empty>
      ) : null}

      <DailySummary>
        <SummaryRow>
          <span>지출 합계</span>
          <SummaryAmount $tone="expense">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "expense" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SummaryRow>
          <span>수입 합계</span>
          <SummaryAmount $tone="income">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "income" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SummaryRow>
          <span>저축 합계</span>
          <SummaryAmount $tone="saving">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "saving" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SettlementRow>
          <span>정산 합계</span>
          <strong>
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter((item) => item.status === "confirmed")
                .reduce(
                  (sum, item) =>
                    sum +
                    (item.type === "income"
                      ? item.amount
                      : item.type === "expense"
                        ? -item.amount
                        : 0),
                  0,
                ),
            )}
          </strong>
        </SettlementRow>
      </DailySummary>

      {deletingInstallment?.recurringRuleId ? (
        <InstallmentDeleteDialog
          transaction={deletingInstallment}
          seriesTransactions={deletingInstallmentSeries}
          busy={isDeletingInstallment}
          onClose={() => setDeletingInstallment(null)}
          onSelect={(scope) => {
            void deleteInstallment(deletingInstallment, scope)
          }}
        />
      ) : null}
    </>
  )
})

const TransactionList = styled.div`
  display: grid;
`

const TransactionGroup = styled.section`
  display: grid;
`

const UserGroup = styled.div`
  display: grid;
`

const RecurrenceGroupHeader = styled.button<{
  $recurring: boolean
  $collapsed: boolean
}>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-bottom: 1px solid ${colors.borderStrong};
  background: ${({ $recurring }) =>
    $recurring ? colors.tealSoft : colors.panelSubtle};
  color: ${({ $recurring }) => ($recurring ? colors.teal : colors.ink)};
  padding: 9px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 750;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: -2px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 600;
  }

  svg {
    transition: transform 160ms ease;
    transform: rotate(${({ $collapsed }) => ($collapsed ? "-90deg" : "0")});
  }
`

const GroupHeaderMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
`

const TransactionGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${colors.borderStrong};
  background: ${colors.panel};
  color: ${colors.ink};
  padding: 7px 9px 7px 18px;
  font-size: 11px;
  font-weight: 700;

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 600;
  }
`

const TransactionItem = styled.article<{ $excluded: boolean }>`
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

const Empty = styled.div`
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: ${colors.muted};
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
`

const DailySummary = styled.section`
  position: sticky;
  z-index: 2;
  bottom: 0;
  display: grid;
  gap: 7px;
  margin-top: 16px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: 0 -10px 20px rgba(24, 24, 27, 0.08);
  padding: 12px;
`

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${colors.muted};
  font-size: 12px;
`

const SummaryAmount = styled.strong<{
  $tone: "expense" | "income" | "saving"
}>`
  color: ${({ $tone }) =>
    $tone === "expense"
      ? colors.coral
      : $tone === "saving"
        ? colors.violet
        : colors.green};
  font-family: var(--font-geist-mono);
`

const SettlementRow = styled(SummaryRow)`
  margin-top: 3px;
  border-top: 1px solid ${colors.border};
  padding-top: 9px;
  color: ${colors.ink};
  font-weight: 700;

  strong {
    font-family: var(--font-geist-mono);
  }
`
