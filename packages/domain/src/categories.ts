import type {
  Category,
  CategoryUsageType,
  TransactionType,
} from "@salimon/types"

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
] as const

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
    expenseCategories.find((category) => category.name === "기타") ??
    expenseCategories
      .filter((category) => category.isDefault)
      .sort((a, b) => b.sortOrder - a.sortOrder)[0]
  )
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
}
