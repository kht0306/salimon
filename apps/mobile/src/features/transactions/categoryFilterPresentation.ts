import { getCategoryLabel } from "@salimon/domain"
import type { Category } from "@salimon/types"

export interface CategoryTreeOption {
  category: Category
  depth: number
  hasChildren: boolean
  label: string
}

export function buildCategoryTreeOptions(
  categories: Category[],
  expandedCategoryIds: ReadonlySet<string>,
  query: string,
): CategoryTreeOption[] {
  const sortedCategories = [...categories].sort(compareCategories)
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")

  if (normalizedQuery) {
    return sortedCategories.flatMap((category) => {
      const label = getCategoryLabel(categories, category.id)
      if (!label.toLocaleLowerCase("ko-KR").includes(normalizedQuery)) {
        return []
      }
      return [
        {
          category,
          depth: 0,
          hasChildren: false,
          label,
        },
      ]
    })
  }

  const categoryIds = new Set(categories.map((category) => category.id))
  const childrenByParent = new Map<string, Category[]>()
  const roots: Category[] = []

  for (const category of sortedCategories) {
    if (
      !category.parentCategoryId ||
      !categoryIds.has(category.parentCategoryId)
    ) {
      roots.push(category)
      continue
    }
    const children = childrenByParent.get(category.parentCategoryId) ?? []
    children.push(category)
    childrenByParent.set(category.parentCategoryId, children)
  }

  const options: CategoryTreeOption[] = []
  function appendCategory(category: Category, depth: number): void {
    const children = childrenByParent.get(category.id) ?? []
    options.push({
      category,
      depth,
      hasChildren: children.length > 0,
      label: category.name,
    })
    if (expandedCategoryIds.has(category.id)) {
      for (const child of children) appendCategory(child, depth + 1)
    }
  }

  for (const root of roots) appendCategory(root, 0)
  return options
}

export function selectedCategoryAncestorIds(
  categories: Category[],
  selectedCategoryIds: string[],
): Set<string> {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const ancestorIds = new Set<string>()

  for (const selectedId of selectedCategoryIds) {
    let category = categoriesById.get(selectedId)
    while (category?.parentCategoryId) {
      ancestorIds.add(category.parentCategoryId)
      category = categoriesById.get(category.parentCategoryId)
    }
  }
  return ancestorIds
}

export function toggleCategorySelection(
  selectedCategoryIds: string[],
  categoryId: string,
): string[] {
  return selectedCategoryIds.includes(categoryId)
    ? selectedCategoryIds.filter((selectedId) => selectedId !== categoryId)
    : [...selectedCategoryIds, categoryId]
}

function compareCategories(first: Category, second: Category): number {
  return (
    first.sortOrder - second.sortOrder ||
    first.name.localeCompare(second.name, "ko-KR")
  )
}
