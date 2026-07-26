import type { Category, Transaction } from "@salimon/types"
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

  it("renders a category's full three-level path", () => {
    const categories: Category[] = [
      createCategory("food", "식비"),
      createCategory("dining", "외식", "food"),
      createCategory("korean", "한식", "dining"),
    ]
    const markup = renderToStaticMarkup(
      <TransactionMetadataChips
        transaction={transaction}
        category={categories[2]}
        categories={categories}
      />,
    )

    expect(markup).toContain("식비 › 외식 › 한식")
  })
})

function createCategory(
  id: string,
  name: string,
  parentCategoryId?: string,
): Category {
  return {
    id,
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    name,
    icon: "circle",
    color: "#2d6a4f",
    sortOrder: 0,
    isDefault: false,
    isArchived: false,
    parentCategoryId,
  }
}
