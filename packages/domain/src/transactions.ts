import type { Transaction } from "@salimon/types"

export type TransactionRecurrenceFilter = "all" | "general" | "recurring"

export function matchesTransactionRecurrence(
  transaction: Transaction,
  filter: TransactionRecurrenceFilter,
): boolean {
  if (filter === "all") return true
  const recurring =
    transaction.recurringType === "fixed" ||
    transaction.recurringType === "installment"
  return filter === "recurring" ? recurring : !recurring
}
