import { describe, expect, it } from "vitest"
import { createDefaultCategories, findOtherCategory } from "../src"

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
})
