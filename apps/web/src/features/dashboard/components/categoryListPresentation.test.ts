import type { Category } from "@salimon/types"
import { describe, expect, it } from "vitest"
import { buildCategoryListPresentation } from "./categoryListPresentation"

const categories: Category[] = [
  createCategory({
    id: "income",
    name: "급여",
    sortOrder: 1,
    usageTypes: ["income"],
  }),
  createCategory({ id: "food", name: "식비", sortOrder: 2 }),
  createCategory({
    id: "cafe",
    name: "카페",
    icon: "coffee",
    sortOrder: 1,
    parentCategoryId: "food",
  }),
  createCategory({ id: "living", name: "생활", icon: "home", sortOrder: 3 }),
]

describe("buildCategoryListPresentation", () => {
  it("uses the manual tree order and exposes monthly budgets", () => {
    const result = present({
      budgets: [
        { category: { id: "food" }, amount: 300_000 },
        { category: { id: "living" }, amount: 100_000 },
      ],
    })

    expect(
      result.visibleCategoryItems.map(({ category }) => category.id),
    ).toEqual(["income", "food", "cafe", "living"])
    expect(result.budgetByCategoryId.get("food")).toBe(300_000)
    expect(result.dndEnabled).toBe(true)
  })

  it("keeps ancestors visible when a child matches the search", () => {
    const result = present({ searchQuery: "카페" })

    expect(
      result.visibleCategoryItems.map(({ category }) => category.id),
    ).toEqual(["food", "cafe"])
  })

  it("matches icon labels and filters by category usage", () => {
    const iconMatch = present({ searchQuery: "음료" })
    const usageMatch = present({ usageFilter: "income" })

    expect(
      iconMatch.visibleCategoryItems.map(({ category }) => category.id),
    ).toEqual(["food", "cafe"])
    expect(
      usageMatch.visibleCategoryItems.map(({ category }) => category.id),
    ).toEqual(["income"])
  })

  it("sorts sibling categories by budget and disables manual reordering", () => {
    const result = present({
      budgets: [
        { category: { id: "food" }, amount: 300_000 },
        { category: { id: "living" }, amount: 100_000 },
      ],
      sortMode: "budget-desc",
    })

    expect(
      result.visibleCategoryItems.map(({ category }) => category.id),
    ).toEqual(["food", "cafe", "living", "income"])
    expect(result.dndEnabled).toBe(false)
  })
})

function present(
  overrides: Partial<Parameters<typeof buildCategoryListPresentation>[0]> = {},
) {
  return buildCategoryListPresentation({
    categories,
    budgets: [],
    searchQuery: "",
    sortMode: "manual",
    usageFilter: "all",
    iconLabels: { coffee: "음료" },
    ...overrides,
  })
}

function createCategory(
  overrides: Partial<Category> & Pick<Category, "id" | "name" | "sortOrder">,
): Category {
  return {
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    icon: "utensils",
    color: "#2d6a4f",
    isDefault: false,
    isArchived: false,
    ...overrides,
  }
}
