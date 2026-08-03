import type { Category, Transaction, TransactionSplit } from "@salimon/types"
import { describe, expect, it } from "vitest"
import { getBudgetTransactionRows } from "./BudgetTransactionsDialog"

const categories: Category[] = [
  createCategory("food", "식비"),
  createCategory("dining", "외식", "food"),
  createCategory("transport", "교통"),
]

const transactions: Transaction[] = [
  createTransaction("child", 10000, {
    categoryId: "dining",
  }),
  createTransaction("split", 30000),
  createTransaction("excluded", 7000, {
    categoryId: "food",
    status: "excluded",
  }),
  createTransaction("other", 5000, {
    categoryId: "transport",
  }),
  createTransaction("income", 20000, {
    categoryId: "food",
    type: "income",
  }),
]

const transactionSplits: TransactionSplit[] = [
  {
    id: "split-food",
    transactionId: "split",
    categoryId: "food",
    amount: 12000,
    sortOrder: 0,
  },
  {
    id: "split-transport",
    transactionId: "split",
    categoryId: "transport",
    amount: 18000,
    sortOrder: 1,
  },
]

describe("getBudgetTransactionRows", () => {
  it("includes confirmed expenses from descendants and category split amounts", () => {
    const rows = getBudgetTransactionRows({
      categoryId: "food",
      categories,
      transactions,
      transactionSplits,
    })

    expect(rows.map((row) => row.transaction.id)).toEqual(["child", "split"])
    expect(rows.map((row) => row.includedAmount)).toEqual([10000, 12000])
    expect(rows.reduce((sum, row) => sum + row.includedAmount, 0)).toBe(22000)
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

function createTransaction(
  id: string,
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    ledgerId: "ledger-1",
    type: "expense",
    status: "confirmed",
    amount,
    currency: "KRW",
    transactionAt: "2026-08-03T03:00:00.000Z",
    sourceType: "manual",
    createdAt: "2026-08-03T03:00:00.000Z",
    updatedAt: "2026-08-03T03:00:00.000Z",
    ...overrides,
  }
}
