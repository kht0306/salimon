import type { Transaction } from "@salimon/types"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TransactionMetadataChips } from "./TransactionMetadataChips"

const transaction: Transaction = {
  id: "transaction-1",
  ledgerId: "ledger-1",
  type: "expense",
  status: "confirmed",
  amount: 10000,
  currency: "KRW",
  transactionAt: "2026-07-01T03:00:00.000Z",
  sourceType: "manual",
  createdAt: "2026-07-01T03:00:00.000Z",
  updatedAt: "2026-07-01T03:00:00.000Z",
}

describe("TransactionMetadataChips", () => {
  it.each([
    [{ type: "expense" as const }, "고정비"],
    [{ type: "income" as const, incomeKind: "salary" as const }, "고정수입"],
    [{ type: "saving" as const }, "정기저축"],
  ])("labels fixed transactions by transaction type", (overrides, label) => {
    const markup = renderToStaticMarkup(
      <TransactionMetadataChips
        transaction={{ ...transaction, ...overrides, recurringType: "fixed" }}
      />,
    )

    expect(markup).toContain(label)
  })
})
