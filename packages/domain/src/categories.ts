import type {
  Category,
  CategoryUsageType,
  Transaction,
  TransactionSplit,
  TransactionType,
} from "@salimon/types"

export const MAX_CATEGORY_DEPTH = 3

export type CategoryDepth = 1 | 2 | 3

export interface CategoryTreeItem {
  category: Category
  depth: CategoryDepth
}

export const expenseCategorySeeds = [
  { name: "식비", icon: "utensils", color: "#d65a3a" },
  { name: "카페/간식", icon: "coffee", color: "#d99a24" },
  { name: "교통", icon: "bus", color: "#3b7f9d" },
  { name: "쇼핑", icon: "shopping-bag", color: "#a65e78" },
  { name: "생활", icon: "shopping-basket", color: "#3f8a70" },
  { name: "주거/통신", icon: "wifi", color: "#586f8f" },
  { name: "의료", icon: "heart-pulse", color: "#c85b52" },
  { name: "문화/여가", icon: "ticket", color: "#755aa8" },
  { name: "교육", icon: "book-open", color: "#b8783e" },
  { name: "기타", icon: "more-horizontal", color: "#727a82" },
  { name: "분할", icon: "list-tree", color: "#d99a24" },
] as const

export const SPLIT_CATEGORY_NAME = "분할"

export function isSplitCategory(category: Category | undefined): boolean {
  return Boolean(
    category?.isDefault &&
    category.type === "expense" &&
    category.name === SPLIT_CATEGORY_NAME,
  )
}

export const incomeCategorySeeds = [
  { name: "급여", icon: "briefcase-business", color: "#2d6a4f" },
  { name: "용돈", icon: "gift", color: "#ce7b32" },
  { name: "이자", icon: "landmark", color: "#416c8c" },
  { name: "환급", icon: "rotate-ccw", color: "#2f8f83" },
  { name: "기타", icon: "circle-plus", color: "#685a8f" },
] as const

export const savingCategorySeeds = [
  { name: "예금", icon: "landmark", color: "#0f766e" },
  { name: "적금", icon: "piggy-bank", color: "#7c3aed" },
  { name: "투자", icon: "chart-no-axes-combined", color: "#2563eb" },
  { name: "기타 저축", icon: "wallet", color: "#727a82" },
] as const

export function createDefaultCategories(
  ledgerId: string,
  userId: string,
): Category[] {
  const expense = expenseCategorySeeds.map((seed, index) =>
    createCategory(
      ledgerId,
      userId,
      "expense",
      seed.name,
      seed.icon,
      seed.color,
      index,
      true,
    ),
  )
  const splitCategory = expense.find((category) => isSplitCategory(category))
  if (splitCategory) {
    splitCategory.usageTypes = ["expense", "income", "saving"]
  }
  const income = incomeCategorySeeds.map((seed, index) =>
    createCategory(
      ledgerId,
      userId,
      "income",
      seed.name,
      seed.icon,
      seed.color,
      index,
      true,
    ),
  )
  const saving = savingCategorySeeds.map((seed, index) =>
    createCategory(
      ledgerId,
      userId,
      "saving",
      seed.name,
      seed.icon,
      seed.color,
      index,
      true,
    ),
  )

  return [...expense, ...income, ...saving]
}

export function createCategory(
  ledgerId: string,
  userId: string,
  type: TransactionType,
  name: string,
  icon: string,
  color: string,
  sortOrder = 0,
  isDefault = false,
): Category {
  const usageType: CategoryUsageType =
    type === "income" || type === "saving" ? type : "expense"
  return {
    id: `${ledgerId}-${type}-${slugify(name)}`,
    ledgerId,
    createdBy: userId,
    type,
    usageTypes: [usageType],
    name,
    icon,
    color,
    sortOrder,
    isDefault,
    isArchived: false,
  }
}

export function findOtherCategory(
  categories: Category[],
  ledgerId: string,
): Category | undefined {
  const expenseCategories = categories.filter(
    (category) =>
      category.ledgerId === ledgerId &&
      category.type === "expense" &&
      !category.isArchived,
  )

  return (
    expenseCategories.find(
      (category) => category.name === "기타" && !category.parentCategoryId,
    ) ??
    expenseCategories
      .filter(
        (category) =>
          category.isDefault &&
          !category.parentCategoryId &&
          !isSplitCategory(category),
      )
      .sort((a, b) => b.sortOrder - a.sortOrder)[0]
  )
}

export function getCategoryPath(
  categories: Category[],
  categoryId: string,
): Category[] {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const path: Category[] = []
  const visited = new Set<string>()
  let current = categoryById.get(categoryId)

  while (current && !visited.has(current.id)) {
    path.unshift(current)
    visited.add(current.id)
    current = current.parentCategoryId
      ? categoryById.get(current.parentCategoryId)
      : undefined
  }

  return path
}

export function getCategoryDepth(
  categories: Category[],
  categoryId: string,
): number {
  return getCategoryPath(categories, categoryId).length
}

export function getCategoryLabel(
  categories: Category[],
  categoryId: string | undefined,
  fallback = "기타",
): string {
  if (!categoryId) return fallback
  const path = getCategoryPath(categories, categoryId)
  return path.length > 0
    ? path.map((category) => category.name).join(" › ")
    : fallback
}

export function getDescendantCategoryIds(
  categories: Category[],
  categoryId: string,
  includeSelf = true,
): Set<string> {
  const childrenByParentId = new Map<string, Category[]>()
  categories.forEach((category) => {
    if (!category.parentCategoryId) return
    childrenByParentId.set(category.parentCategoryId, [
      ...(childrenByParentId.get(category.parentCategoryId) ?? []),
      category,
    ])
  })

  const descendants = new Set<string>(includeSelf ? [categoryId] : [])
  const pending = [...(childrenByParentId.get(categoryId) ?? [])]

  while (pending.length > 0) {
    const category = pending.pop()
    if (!category || descendants.has(category.id)) continue
    descendants.add(category.id)
    pending.push(...(childrenByParentId.get(category.id) ?? []))
  }

  return descendants
}

export function buildCategoryTree(
  categories: Category[],
  compareCategories?: (first: Category, second: Category) => number,
): CategoryTreeItem[] {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const childrenByParentId = new Map<string, Category[]>()
  const roots: Category[] = []
  const ordered: CategoryTreeItem[] = []
  const visited = new Set<string>()
  const sortCategories = (items: Category[]) =>
    [...items].sort(
      compareCategories ??
        ((first, second) =>
          first.sortOrder - second.sortOrder ||
          first.name.localeCompare(second.name, "ko-KR") ||
          first.id.localeCompare(second.id)),
    )

  categories.forEach((category) => {
    if (
      !category.parentCategoryId ||
      !categoryById.has(category.parentCategoryId)
    ) {
      roots.push(category)
      return
    }
    childrenByParentId.set(category.parentCategoryId, [
      ...(childrenByParentId.get(category.parentCategoryId) ?? []),
      category,
    ])
  })

  const visit = (category: Category, depth: number) => {
    if (visited.has(category.id)) return
    visited.add(category.id)
    ordered.push({
      category,
      depth: Math.min(depth, MAX_CATEGORY_DEPTH) as CategoryDepth,
    })
    sortCategories(childrenByParentId.get(category.id) ?? []).forEach((child) =>
      visit(child, depth + 1),
    )
  }

  sortCategories(roots).forEach((category) => visit(category, 1))
  sortCategories(
    categories.filter((category) => !visited.has(category.id)),
  ).forEach((category) => visit(category, 1))

  return ordered
}

export function transactionAmountForCategoryIds(
  transaction: Transaction,
  splits: TransactionSplit[],
  categoryIds: Set<string>,
): number {
  const transactionSplits = splits.filter(
    (split) => split.transactionId === transaction.id,
  )
  if (transactionSplits.length > 0) {
    return transactionSplits
      .filter((split) => categoryIds.has(split.categoryId))
      .reduce((sum, split) => sum + split.amount, 0)
  }
  return transaction.categoryId && categoryIds.has(transaction.categoryId)
    ? transaction.amount
    : 0
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
}
