"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { InstallmentDeleteScope, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { InstallmentDeleteDialog } from "./InstallmentDeleteDialog"
import { TransactionHistoryList } from "./TransactionHistoryList"

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
      <TransactionHistoryList
        isDeletingInstallment={isDeletingInstallment}
        onCopy={onCopy}
        onEdit={onEdit}
        onEndInstallment={(transaction) => {
          void deleteInstallment(transaction, "future")
        }}
        onOpenInstallmentDelete={setDeletingInstallment}
      />

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
