import type { Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import { matchesTransactionRecurrence } from "./transactions"

const transaction: Transaction = {
  id: "general",
  ledgerId: "ledger",
  type: "expense",
  status: "confirmed",
  amount: 1000,
  currency: "KRW",
  sourceType: "manual",
  transactionAt: "2026-10-15T12:00:00+09:00",
  createdAt: "2026-10-15T12:00:00+09:00",
  updatedAt: "2026-10-15T12:00:00+09:00",
}

describe("transaction recurrence filter", () => {
  it.each([undefined, "fixed", "installment"] as const)(
    "includes recurringType=%s in the correct filters",
    (recurringType) => {
      const item = { ...transaction, recurringType }
      expect(matchesTransactionRecurrence(item, "all")).toBe(true)
      expect(matchesTransactionRecurrence(item, "general")).toBe(!recurringType)
      expect(matchesTransactionRecurrence(item, "recurring")).toBe(
        Boolean(recurringType),
      )
    },
  )
})
