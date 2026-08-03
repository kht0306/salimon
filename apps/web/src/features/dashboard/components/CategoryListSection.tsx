"use client"

import styled from "@emotion/styled"
import {
  buildCategoryTree,
  formatMoneyInput,
  getCategoryDepth,
  getCategoryLabel,
  getCategoryPath,
  getDescendantCategoryIds,
  isSplitCategory,
  MAX_CATEGORY_DEPTH,
} from "@salimon/domain"
import type { Category, CategoryUsageType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Archive,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { type DragEvent, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, IconButton, Input, Select } from "../styles"
import {
  CategoryIcon,
  CategoryUsageSelector,
  ColorPicker,
  categoryUsageOptions,
  colorOptions,
  hexColorPattern,
  iconLabels,
  iconOptions,
} from "./categoryEditorFields"

type CategorySortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "budget-asc"
  | "budget-desc"
type CategoryUsageFilter = "all" | CategoryUsageType
function canMoveCategoryUnder(
  categories: Category[],
  category: Category,
  parent: Category,
  usageTypes: CategoryUsageType[],
): boolean {
  if (isSplitCategory(parent)) return false
  const descendants = getDescendantCategoryIds(categories, category.id)
  if (descendants.has(parent.id)) return false

  const categoryDepth = getCategoryDepth(categories, category.id)
  const subtreeHeight = Math.max(
    1,
    ...[...descendants].map(
      (descendantId) =>
        getCategoryDepth(categories, descendantId) - categoryDepth + 1,
    ),
  )
  return (
    getCategoryDepth(categories, parent.id) + subtreeHeight <=
      MAX_CATEGORY_DEPTH &&
    usageTypes.every((usageType) => parent.usageTypes.includes(usageType))
  )
}

interface CategoryListSectionProps {
  onCreateParentCategoryChange: (categoryId: string) => void
}

export const CategoryListSection = observer(function CategoryListSection({
  onCreateParentCategoryChange,
}: CategoryListSectionProps) {
  const store = useAppStore()
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState(iconOptions[0].value)
  const [editColor, setEditColor] = useState(colorOptions[0])
  const [editUsageTypes, setEditUsageTypes] = useState<CategoryUsageType[]>([])
  const [editParentCategoryId, setEditParentCategoryId] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState<CategorySortMode>("manual")
  const [usageFilter, setUsageFilter] = useState<CategoryUsageFilter>("all")

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR")
  const dndEnabled =
    usageFilter === "all" &&
    sortMode === "manual" &&
    normalizedQuery.length === 0
  const budgetByCategoryId = new Map(
    store.selectedMonthBudgets.map((item) => [item.category.id, item.amount]),
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
  const categoryTree = buildCategoryTree(
    store.currentCategories,
    compareCategories,
  )
  const matchedCategoryIds = new Set(
    categoryTree
      .filter(({ category }) => {
        const usageMatches =
          usageFilter === "all" || category.usageTypes.includes(usageFilter)
        const searchMatches = normalizedQuery
          ? `${getCategoryLabel(store.currentCategories, category.id)} ${iconLabels[category.icon] ?? category.icon}`
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery)
          : true
        return usageMatches && searchMatches
      })
      .map(({ category }) => category.id),
  )
  const visibleCategoryIds = new Set(
    [...matchedCategoryIds].flatMap((categoryId) =>
      getCategoryPath(store.currentCategories, categoryId).map(
        (category) => category.id,
      ),
    ),
  )
  const visibleCategoryItems = categoryTree.filter(({ category }) =>
    visibleCategoryIds.has(category.id),
  )

  function startEditing(category: Category) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditIcon(category.icon)
    setEditColor(category.color)
    setEditUsageTypes(category.usageTypes)
    setEditParentCategoryId(category.parentCategoryId ?? "")
  }

  async function saveEditing() {
    if (!editingId) return
    if (
      await store.updateCategory(editingId, {
        name: editName,
        icon: editIcon,
        color: editColor,
        usageTypes: editUsageTypes,
        parentCategoryId: editParentCategoryId,
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
      <CategoryListToolbar>
        <CategorySearchField>
          <Search size={15} aria-hidden="true" />
          <Input
            type="search"
            aria-label="카테고리 검색"
            placeholder="카테고리 검색"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setDraggingId(null)
              setDragOverId(null)
            }}
          />
        </CategorySearchField>
        <CategoryFilterSelect
          aria-label="카테고리 용도 조회"
          value={usageFilter}
          onChange={(event) => {
            setUsageFilter(event.target.value as CategoryUsageFilter)
            setDraggingId(null)
            setDragOverId(null)
          }}
        >
          <option value="all">전체</option>
          <option value="expense">지출용</option>
          <option value="income">수입용</option>
          <option value="saving">저축용</option>
        </CategoryFilterSelect>
        <CategorySortSelect
          aria-label="카테고리 정렬"
          value={sortMode}
          onChange={(event) => {
            setSortMode(event.target.value as CategorySortMode)
            setDraggingId(null)
            setDragOverId(null)
          }}
        >
          <option value="manual">사용자 지정 순서</option>
          <option value="name-asc">이름 오름차순</option>
          <option value="name-desc">이름 내림차순</option>
          <option value="budget-asc">예산 낮은 순</option>
          <option value="budget-desc">예산 높은 순</option>
        </CategorySortSelect>
        {!dndEnabled ? (
          <ReorderHint>
            전체 조회·사용자 지정 순서이며 검색어가 없을 때만 순서를 변경할 수
            있습니다.
          </ReorderHint>
        ) : null}
      </CategoryListToolbar>

      <CategoryList>
        {visibleCategoryItems.map(({ category, depth }) => {
          const hasChildren = store.currentCategories.some(
            (item) => item.parentCategoryId === category.id,
          )
          return (
            <CategoryRow
              key={category.id}
              $isDragging={draggingId === category.id}
              $isDragOver={dragOverId === category.id}
              onDragOver={(event) => handleDragOver(event, category.id)}
              onDragLeave={(event) => handleDragLeave(event, category.id)}
              onDrop={(event) => void handleDrop(event, category.id)}
            >
              <DragHandle
                type="button"
                title={
                  dndEnabled
                    ? "순서 변경"
                    : "사용자 지정 순서에서만 변경할 수 있습니다"
                }
                aria-label={`${category.name} 순서 변경`}
                draggable={dndEnabled && !savingOrder}
                disabled={!dndEnabled || savingOrder}
                onDragStart={(event) => handleDragStart(event, category.id)}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverId(null)
                }}
              >
                <GripVertical size={16} />
              </DragHandle>
              {editingId === category.id ? (
                <CategoryEditor>
                  <Input
                    aria-label={`${category.name} 카테고리 이름`}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveEditing()
                      if (event.key === "Escape") setEditingId(null)
                    }}
                  />
                  <Select
                    aria-label={`${category.name} 카테고리 아이콘`}
                    value={editIcon}
                    onChange={(event) => setEditIcon(event.target.value)}
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <ColorPicker
                    value={editColor}
                    onChange={setEditColor}
                    label={`${category.name} 카테고리`}
                  />
                  <CategoryUsageSelector
                    value={editUsageTypes}
                    onChange={setEditUsageTypes}
                    label="적용 용도"
                  />
                  <Select
                    aria-label={`${category.name} 상위 카테고리`}
                    value={editParentCategoryId}
                    onChange={(event) =>
                      setEditParentCategoryId(event.target.value)
                    }
                  >
                    <option value="">최상위 카테고리</option>
                    {store.currentCategories
                      .filter((parent) =>
                        canMoveCategoryUnder(
                          store.currentCategories,
                          category,
                          parent,
                          editUsageTypes,
                        ),
                      )
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {getCategoryLabel(store.currentCategories, parent.id)}
                        </option>
                      ))}
                  </Select>
                </CategoryEditor>
              ) : (
                <CategorySummary $depth={depth}>
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <CategoryInfo>
                    <strong>{category.name}</strong>
                    <span>
                      {depth}단계 ·{" "}
                      {getCategoryLabel(store.currentCategories, category.id)} ·{" "}
                      {category.usageTypes
                        .map(
                          (usageType) =>
                            categoryUsageOptions.find(
                              (option) => option.value === usageType,
                            )?.label,
                        )
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </CategoryInfo>
                </CategorySummary>
              )}
              {category.usageTypes.includes("expense") ? (
                <BudgetField>
                  <Input
                    aria-label={`${category.name} ${store.selectedMonth} 예산`}
                    inputMode="numeric"
                    placeholder="월 예산"
                    value={formatMoneyInput(
                      budgets[category.id] ??
                        budgetByCategoryId.get(category.id) ??
                        "",
                    )}
                    onChange={(event) =>
                      setBudgets({
                        ...budgets,
                        [category.id]: event.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                  <Button
                    $variant="soft"
                    onClick={() =>
                      void store.setCategoryBudget(
                        category.id,
                        Number(
                          budgets[category.id] ??
                            budgetByCategoryId.get(category.id) ??
                            0,
                        ),
                      )
                    }
                  >
                    예산 저장
                  </Button>
                </BudgetField>
              ) : (
                <BudgetUnavailable>예산 미적용</BudgetUnavailable>
              )}
              <CategoryActions>
                {depth < MAX_CATEGORY_DEPTH && !isSplitCategory(category) ? (
                  <IconButton
                    title={`${category.name} 하위 카테고리 추가`}
                    aria-label={`${category.name} 하위 카테고리 추가`}
                    onClick={() => {
                      onCreateParentCategoryChange(category.id)
                      document.getElementById("category-create-name")?.focus()
                    }}
                  >
                    <Plus size={15} />
                  </IconButton>
                ) : null}
                {editingId === category.id ? (
                  <>
                    <IconButton
                      $variant="primary"
                      title="카테고리 수정 저장"
                      aria-label={`${category.name} 수정 저장`}
                      disabled={
                        !editName.trim() ||
                        !hexColorPattern.test(editColor) ||
                        editUsageTypes.length === 0
                      }
                      onClick={() => void saveEditing()}
                    >
                      <Check size={15} />
                    </IconButton>
                    <IconButton
                      title="카테고리 수정 취소"
                      aria-label={`${category.name} 수정 취소`}
                      onClick={() => setEditingId(null)}
                    >
                      <X size={15} />
                    </IconButton>
                  </>
                ) : (
                  <IconButton
                    title={
                      isSplitCategory(category)
                        ? "분할 카테고리는 수정할 수 없습니다"
                        : "카테고리 수정"
                    }
                    aria-label={`${category.name} 수정`}
                    disabled={isSplitCategory(category)}
                    onClick={() => startEditing(category)}
                  >
                    <Pencil size={15} />
                  </IconButton>
                )}
                <IconButton
                  $variant="danger"
                  title={
                    hasChildren
                      ? "하위 카테고리를 먼저 이동하거나 제거해 주세요"
                      : category.name === "기타" || isSplitCategory(category)
                        ? `${category.name} 카테고리는 제거할 수 없습니다`
                        : "카테고리 제거"
                  }
                  aria-label={`${category.name} 제거`}
                  disabled={
                    hasChildren ||
                    category.name === "기타" ||
                    isSplitCategory(category)
                  }
                  onClick={() => void store.archiveCategory(category.id)}
                >
                  <Archive size={15} />
                </IconButton>
              </CategoryActions>
            </CategoryRow>
          )
        })}
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

const CategoryListToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 8px;

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
  }
`

const CategorySearchField = styled.div`
  position: relative;
  flex: 1;

  svg {
    position: absolute;
    top: 50%;
    left: 11px;
    z-index: 1;
    color: ${colors.muted};
    pointer-events: none;
    transform: translateY(-50%);
  }

  input {
    padding-left: 34px;
  }
`

const CategorySortSelect = styled(Select)`
  width: 180px;

  @media (max-width: 720px) {
    width: 100%;
  }
`

const CategoryFilterSelect = styled(CategorySortSelect)`
  width: 120px;
`

const ReorderHint = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`

const EmptyCategoryList = styled.div`
  padding: 28px 12px;
  color: ${colors.muted};
  text-align: center;
  font-size: 13px;
`

const BudgetField = styled.div`
  display: flex;
  gap: 6px;
  input {
    width: 110px;
  }

  @media (max-width: 860px) {
    grid-column: 2 / -1;
  }
`

const BudgetUnavailable = styled.span`
  color: ${colors.subtle};
  font-size: 12px;
  text-align: center;
`

const CategoryRow = styled.div<{
  $isDragging: boolean
  $isDragOver: boolean
}>`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) minmax(220px, auto) auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;
  opacity: ${({ $isDragging }) => ($isDragging ? 0.45 : 1)};
  background: ${({ $isDragOver }) =>
    $isDragOver ? "rgba(45, 106, 79, 0.08)" : "transparent"};
  box-shadow: ${({ $isDragOver }) =>
    $isDragOver ? `inset 3px 0 0 ${colors.teal}` : "none"};
  transition:
    background 120ms ease,
    box-shadow 120ms ease,
    opacity 120ms ease;

  @media (max-width: 860px) {
    grid-template-columns: 28px minmax(0, 1fr) auto;
  }
`

const DragHandle = styled.button`
  width: 28px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: ${radii.sm};
  background: transparent;
  color: ${colors.muted};
  cursor: grab;

  &:hover,
  &:focus-visible {
    background: ${colors.panelSubtle};
    color: ${colors.ink};
  }

  &:active {
    cursor: grabbing;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

const CategorySummary = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-left: ${({ $depth }) => ($depth - 1) * 22}px;
`

const CategoryEditor = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
  align-items: center;
  gap: 8px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const CategoryActions = styled.div`
  display: flex;
  gap: 4px;
`

const CategoryInfo = styled.div`
  min-width: 0;
  display: grid;
  gap: 2px;

  span {
    color: ${colors.muted};
    font-size: 12px;
  }
`
