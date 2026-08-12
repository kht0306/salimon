import type { Category } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  buildCategoryTreeOptions,
  selectedCategoryAncestorIds,
  toggleCategorySelection,
} from "./categoryFilterPresentation"

const categories: Category[] = [
  createCategory("living", "생활비", 0),
  createCategory("food", "식비", 0, "living"),
  createCategory("dining", "외식", 1, "food"),
  createCategory("archived", "예전 분류", 1),
]

describe("mobile category filter presentation", () => {
  it("shows only roots until a parent is expanded", () => {
    expect(
      buildCategoryTreeOptions(categories, new Set(), "").map((option) => [
        option.category.id,
        option.depth,
      ]),
    ).toEqual([
      ["living", 0],
      ["archived", 0],
    ])

    expect(
      buildCategoryTreeOptions(categories, new Set(["living"]), "").map(
        (option) => [option.category.id, option.depth],
      ),
    ).toEqual([
      ["living", 0],
      ["food", 1],
      ["archived", 0],
    ])
  })

  it("shows matching descendants with their full path while searching", () => {
    expect(
      buildCategoryTreeOptions(categories, new Set(), "외식").map(
        (option) => option.label,
      ),
    ).toEqual(["생활비 › 식비 › 외식"])
  })

  it("opens every ancestor of an already selected child", () => {
    expect(
      [...selectedCategoryAncestorIds(categories, ["dining"])].sort(),
    ).toEqual(["food", "living"])
  })

  it("adds and removes category selections without mutating the input", () => {
    const selected = ["living"]

    expect(toggleCategorySelection(selected, "food")).toEqual([
      "living",
      "food",
    ])
    expect(toggleCategorySelection(selected, "living")).toEqual([])
    expect(selected).toEqual(["living"])
  })
})

function createCategory(
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
    color: "#0f766e",
    sortOrder,
    isDefault: true,
    isArchived: id === "archived",
    parentCategoryId,
  }
}
