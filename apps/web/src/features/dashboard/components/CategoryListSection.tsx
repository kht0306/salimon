"use client"

import styled from "@emotion/styled"
import type { Category } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { type DragEvent, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { colorOptions, iconLabels, iconOptions } from "./categoryEditorFields"
import {
  CategoryListRow,
  type CategoryListRowEditState,
} from "./CategoryListRow"
import { CategoryListToolbar } from "./CategoryListToolbar"
import {
  buildCategoryListPresentation,
  type CategorySortMode,
  type CategoryUsageFilter,
} from "./categoryListPresentation"

interface CategoryListSectionProps {
  onCreateParentCategoryChange: (categoryId: string) => void
}

export const CategoryListSection = observer(function CategoryListSection({
  onCreateParentCategoryChange,
}: CategoryListSectionProps) {
  const store = useAppStore()
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<CategoryListRowEditState>({
    name: "",
    icon: iconOptions[0].value,
    color: colorOptions[0],
    usageTypes: [],
    parentCategoryId: "",
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState<CategorySortMode>("manual")
  const [usageFilter, setUsageFilter] = useState<CategoryUsageFilter>("all")

  const { budgetByCategoryId, dndEnabled, visibleCategoryItems } =
    buildCategoryListPresentation({
      categories: store.currentCategories,
      budgets: store.selectedMonthBudgets,
      searchQuery,
      sortMode,
      usageFilter,
      iconLabels,
    })

  function startEditing(category: Category) {
    setEditingId(category.id)
    setEditState({
      name: category.name,
      icon: category.icon,
      color: category.color,
      usageTypes: category.usageTypes,
      parentCategoryId: category.parentCategoryId ?? "",
    })
  }

  async function saveEditing() {
    if (!editingId) return
    if (
      await store.updateCategory(editingId, {
        name: editState.name,
        icon: editState.icon,
        color: editState.color,
        usageTypes: editState.usageTypes,
        parentCategoryId: editState.parentCategoryId,
      })
    ) {
      setEditingId(null)
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    categoryId: string,
  ) {
    if (savingOrder || !dndEnabled) return

    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", categoryId)
    setDraggingId(categoryId)
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    if (!dndEnabled || !draggingId || draggingId === categoryId) return
    const draggingCategory = store.currentCategories.find(
      (category) => category.id === draggingId,
    )
    const targetCategory = store.currentCategories.find(
      (category) => category.id === categoryId,
    )
    if (
      !draggingCategory ||
      !targetCategory ||
      draggingCategory.parentCategoryId !== targetCategory.parentCategoryId
    ) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverId(categoryId)
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    const nextTarget = event.relatedTarget
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return
    }

    setDragOverId((current) => (current === categoryId ? null : current))
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    event.preventDefault()
    if (!dndEnabled) return

    const sourceCategoryId =
      draggingId || event.dataTransfer.getData("text/plain")

    setDraggingId(null)
    setDragOverId(null)
    if (!sourceCategoryId || sourceCategoryId === categoryId) return
    const sourceCategory = store.currentCategories.find(
      (category) => category.id === sourceCategoryId,
    )
    const targetCategory = store.currentCategories.find(
      (category) => category.id === categoryId,
    )
    if (
      !sourceCategory ||
      !targetCategory ||
      sourceCategory.parentCategoryId !== targetCategory.parentCategoryId
    ) {
      return
    }

    setSavingOrder(true)
    try {
      await store.reorderCategories(sourceCategoryId, categoryId)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <>
      <CategoryListToolbar
        searchQuery={searchQuery}
        sortMode={sortMode}
        usageFilter={usageFilter}
        dndEnabled={dndEnabled}
        onSearchQueryChange={(query) => {
          setSearchQuery(query)
          setDraggingId(null)
          setDragOverId(null)
        }}
        onSortModeChange={(mode) => {
          setSortMode(mode)
          setDraggingId(null)
          setDragOverId(null)
        }}
        onUsageFilterChange={(filter) => {
          setUsageFilter(filter)
          setDraggingId(null)
          setDragOverId(null)
        }}
      />

      <CategoryList>
        {visibleCategoryItems.map(({ category, depth }) => (
          <CategoryListRow
            key={category.id}
            category={category}
            depth={depth}
            budgetValue={
              budgets[category.id] ?? budgetByCategoryId.get(category.id) ?? ""
            }
            editing={editingId === category.id}
            editState={editState}
            dndEnabled={dndEnabled}
            savingOrder={savingOrder}
            isDragging={draggingId === category.id}
            isDragOver={dragOverId === category.id}
            onBudgetChange={(value) =>
              setBudgets((current) => ({
                ...current,
                [category.id]: value,
              }))
            }
            onEditStart={() => startEditing(category)}
            onEditChange={(changes) =>
              setEditState((current) => ({ ...current, ...changes }))
            }
            onEditSave={() => void saveEditing()}
            onEditCancel={() => setEditingId(null)}
            onCreateChild={() => onCreateParentCategoryChange(category.id)}
            onDragStart={(event) => handleDragStart(event, category.id)}
            onDragEnd={() => {
              setDraggingId(null)
              setDragOverId(null)
            }}
            onDragOver={(event) => handleDragOver(event, category.id)}
            onDragLeave={(event) => handleDragLeave(event, category.id)}
            onDrop={(event) => void handleDrop(event, category.id)}
          />
        ))}
        {visibleCategoryItems.length === 0 ? (
          <EmptyCategoryList>검색 결과가 없습니다.</EmptyCategoryList>
        ) : null}
      </CategoryList>
    </>
  )
})

const CategoryList = styled.div`
  display: grid;
  padding: 4px 18px 12px;
`

const EmptyCategoryList = styled.div`
  padding: 28px 12px;
  color: ${colors.muted};
  text-align: center;
  font-size: 13px;
`
