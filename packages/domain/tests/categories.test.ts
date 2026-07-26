import { describe, expect, it } from "vitest"
import {
  buildCategoryTree,
  createDefaultCategories,
  findOtherCategory,
  getCategoryDepth,
  getCategoryLabel,
  getDescendantCategoryIds,
  isSplitCategory,
  transactionAmountForCategoryIds,
} from "../src"
import type { Category, Transaction, TransactionSplit } from "@salimon/types"

describe("findOtherCategory", () => {
  it("keeps the default fallback category after it is renamed", () => {
    const categories = createDefaultCategories("ledger-1", "user-1")
    const other = categories.find(
      (category) => category.type === "expense" && category.name === "기타",
    )

    expect(other).toBeDefined()
    if (!other) return

    other.name = "분류 없음"

    expect(findOtherCategory(categories, "ledger-1")?.id).toBe(other.id)
  })
})

describe("createDefaultCategories", () => {
  it("provides category choices for income and savings", () => {
    const categories = createDefaultCategories("ledger-1", "user-1")

    expect(categories.some((category) => category.type === "income")).toBe(true)
    expect(categories.some((category) => category.type === "saving")).toBe(true)
  })

  it("includes a protected split category", () => {
    const categories = createDefaultCategories("ledger-1", "user-1")
    const splitCategory = categories.find((category) =>
      isSplitCategory(category),
    )

    expect(splitCategory).toMatchObject({
      name: "분할",
      type: "expense",
      usageTypes: ["expense", "income", "saving"],
      isDefault: true,
      isArchived: false,
    })
  })
})

function category(
  id: string,
  name: string,
  sortOrder: number,
  parentCategoryId?: string,
): Category {
  return {
    id,
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    name,
    icon: "circle",
    color: "#000000",
    sortOrder,
    isDefault: false,
    isArchived: false,
    parentCategoryId,
  }
}

const hierarchicalCategories = [
  category("food", "식비", 0),
  category("transport", "교통", 1),
  category("dining", "외식", 0, "food"),
  category("grocery", "장보기", 1, "food"),
  category("korean", "한식", 0, "dining"),
]

describe("category hierarchy", () => {
  it("builds full labels and depths through three levels", () => {
    expect(getCategoryLabel(hierarchicalCategories, "korean")).toBe(
      "식비 › 외식 › 한식",
    )
    expect(getCategoryDepth(hierarchicalCategories, "food")).toBe(1)
    expect(getCategoryDepth(hierarchicalCategories, "dining")).toBe(2)
    expect(getCategoryDepth(hierarchicalCategories, "korean")).toBe(3)
  })

  it("returns all descendant ids for parent filtering", () => {
    expect([
      ...getDescendantCategoryIds(hierarchicalCategories, "food"),
    ]).toEqual(expect.arrayContaining(["food", "dining", "grocery", "korean"]))
  })

  it("flattens categories in parent and sibling order", () => {
    expect(
      buildCategoryTree(hierarchicalCategories).map(
        ({ category: item, depth }) => `${depth}:${item.id}`,
      ),
    ).toEqual(["1:food", "2:dining", "3:korean", "2:grocery", "1:transport"])
  })
})

describe("transactionAmountForCategoryIds", () => {
  const transaction: Transaction = {
    id: "transaction-1",
    ledgerId: "ledger-1",
    type: "expense",
    status: "confirmed",
    amount: 30_000,
    currency: "KRW",
    transactionAt: "2026-07-01T12:00:00.000Z",
    categoryId: "food",
    sourceType: "manual",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
  }

  it("counts direct and descendant categories in a parent total", () => {
    expect(
      transactionAmountForCategoryIds(
        transaction,
        [],
        getDescendantCategoryIds(hierarchicalCategories, "food"),
      ),
    ).toBe(30_000)
  })

  it("counts split categories once instead of the split base category", () => {
    const splits: TransactionSplit[] = [
      {
        id: "split-1",
        transactionId: transaction.id,
        categoryId: "korean",
        amount: 20_000,
        sortOrder: 0,
      },
      {
        id: "split-2",
        transactionId: transaction.id,
        categoryId: "transport",
        amount: 10_000,
        sortOrder: 1,
      },
    ]

    expect(
      transactionAmountForCategoryIds(
        { ...transaction, categoryId: "split" },
        splits,
        getDescendantCategoryIds(hierarchicalCategories, "food"),
      ),
    ).toBe(20_000)
  })
})
