import { toDateKey } from "@salimon/domain"
import type { Transaction, TransactionType } from "@salimon/types"

export interface TransactionTotals {
  expense: number
  income: number
  saving: number
}

export interface MonthDaySummary extends TransactionTotals {
  count: number
  date: string
  dayOfMonth: number
}

export function calculateConfirmedTotals(
  transactions: Transaction[],
): TransactionTotals {
  return transactions.reduce<TransactionTotals>(
    (totals, transaction) => {
      if (transaction.status === "confirmed" && !transaction.deletedAt) {
        totals[transaction.type] += transaction.amount
      }
      return totals
    },
    { expense: 0, income: 0, saving: 0 },
  )
}

export function buildMonthDaySummaries(
  monthKey: string,
  transactions: Transaction[],
): MonthDaySummary[] {
  const [year, month] = monthKey.split("-").map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const summaries = Array.from({ length: daysInMonth }, (_, index) => ({
    count: 0,
    date: `${monthKey}-${String(index + 1).padStart(2, "0")}`,
    dayOfMonth: index + 1,
    expense: 0,
    income: 0,
    saving: 0,
  }))
  const summaryByDate = new Map(
    summaries.map((summary) => [summary.date, summary]),
  )

  transactions.forEach((transaction) => {
    if (transaction.deletedAt) return
    const summary = summaryByDate.get(
      toDateKey(new Date(transaction.transactionAt)),
    )
    if (!summary) return

    summary.count += 1
    if (transaction.status === "confirmed") {
      summary[transaction.type] += transaction.amount
    }
  })

  return summaries
}

export function transactionTypeLabel(type: TransactionType): string {
  if (type === "income") return "수입"
  if (type === "saving") return "저축"
  return "지출"
}
