import {
  buildCategoryTree,
  getCategoryLabel,
  getCategoryPath,
  type CategoryTreeItem,
} from "@salimon/domain"
import type { Category, CategoryUsageType } from "@salimon/types"

export type CategorySortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "budget-asc"
  | "budget-desc"

export type CategoryUsageFilter = "all" | CategoryUsageType

interface CategoryBudgetSummary {
  category: Pick<Category, "id">
  amount: number
}

interface BuildCategoryListPresentationInput {
  categories: Category[]
  budgets: CategoryBudgetSummary[]
  searchQuery: string
  sortMode: CategorySortMode
  usageFilter: CategoryUsageFilter
  iconLabels: Readonly<Record<string, string>>
}

interface CategoryListPresentation {
  budgetByCategoryId: ReadonlyMap<string, number>
  dndEnabled: boolean
  visibleCategoryItems: CategoryTreeItem[]
}

export function buildCategoryListPresentation({
  categories,
  budgets,
  searchQuery,
  sortMode,
  usageFilter,
  iconLabels,
}: BuildCategoryListPresentationInput): CategoryListPresentation {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR")
  const budgetByCategoryId = new Map(
    budgets.map((item) => [item.category.id, item.amount]),
  )
  const compareCategories = (first: Category, second: Category) => {
    if (sortMode === "name-asc") {
      return first.name.localeCompare(second.name, "ko-KR")
    }
    if (sortMode === "name-desc") {
      return second.name.localeCompare(first.name, "ko-KR")
    }
    if (sortMode === "budget-asc") {
      return (
        (budgetByCategoryId.get(first.id) ?? 0) -
          (budgetByCategoryId.get(second.id) ?? 0) ||
        first.sortOrder - second.sortOrder
      )
    }
    if (sortMode === "budget-desc") {
      return (
        (budgetByCategoryId.get(second.id) ?? 0) -
          (budgetByCategoryId.get(first.id) ?? 0) ||
        first.sortOrder - second.sortOrder
      )
    }
    return first.sortOrder - second.sortOrder
  }
  const categoryTree = buildCategoryTree(categories, compareCategories)
  const matchedCategoryIds = new Set(
    categoryTree
      .filter(({ category }) => {
        const usageMatches =
          usageFilter === "all" || category.usageTypes.includes(usageFilter)
        const searchMatches = normalizedQuery
          ? `${getCategoryLabel(categories, category.id)} ${iconLabels[category.icon] ?? category.icon}`
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery)
          : true
        return usageMatches && searchMatches
      })
      .map(({ category }) => category.id),
  )
  const visibleCategoryIds = new Set(
    [...matchedCategoryIds].flatMap((categoryId) =>
      getCategoryPath(categories, categoryId).map((category) => category.id),
    ),
  )

  return {
    budgetByCategoryId,
    dndEnabled:
      usageFilter === "all" &&
      sortMode === "manual" &&
      normalizedQuery.length === 0,
    visibleCategoryItems: categoryTree.filter(({ category }) =>
      visibleCategoryIds.has(category.id),
    ),
  }
}
