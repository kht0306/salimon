import type { Category, TransactionType } from "@salimon/types"

export const expenseCategorySeeds = [
  { name: "식비", icon: "utensils", color: "#2d6a4f" },
  { name: "카페/간식", icon: "coffee", color: "#9c6644" },
  { name: "교통", icon: "bus", color: "#277da1" },
  { name: "쇼핑", icon: "shopping-bag", color: "#b56576" },
  { name: "생활", icon: "home", color: "#4d908e" },
  { name: "주거/통신", icon: "wifi", color: "#577590" },
  { name: "의료", icon: "heart-pulse", color: "#e76f51" },
  { name: "문화/여가", icon: "ticket", color: "#7b2cbf" },
  { name: "교육", icon: "book-open", color: "#f4a261" },
  { name: "기타", icon: "more-horizontal", color: "#6c757d" },
] as const

export const incomeCategorySeeds = [
  { name: "급여", icon: "briefcase-business", color: "#2a9d8f" },
  { name: "용돈", icon: "gift", color: "#f77f00" },
  { name: "이자", icon: "landmark", color: "#457b9d" },
  { name: "환급", icon: "rotate-ccw", color: "#06d6a0" },
  { name: "기타", icon: "more-horizontal", color: "#6c757d" },
] as const

export function createDefaultCategories(ledgerId: string, userId: string): Category[] {
  const expense = expenseCategorySeeds.map((seed, index) =>
    createCategory(ledgerId, userId, "expense", seed.name, seed.icon, seed.color, index, true),
  )
  const income = incomeCategorySeeds.map((seed, index) =>
    createCategory(ledgerId, userId, "income", seed.name, seed.icon, seed.color, index, true),
  )

  return [...expense, ...income]
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
  return {
    id: `${ledgerId}-${type}-${slugify(name)}`,
    ledgerId,
    createdBy: userId,
    type,
    name,
    icon,
    color,
    sortOrder,
    isDefault,
    isArchived: false,
  }
}

export function findOtherCategory(categories: Category[], ledgerId: string): Category | undefined {
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
