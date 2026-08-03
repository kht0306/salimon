import { toDateKey } from "@salimon/domain"
import type { Transaction } from "@salimon/types"

export type PeriodPreset = "3" | "7" | "14" | "21" | "28" | "custom" | "all"

export function resolveRange(
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

export function resolveTransactionRange(
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
