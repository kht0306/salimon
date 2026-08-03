"use client"

import styled from "@emotion/styled"
import {
  formatMoneyInput,
  getCategoryDepth,
  getCategoryLabel,
  getDescendantCategoryIds,
  isSplitCategory,
  MAX_CATEGORY_DEPTH,
  type CategoryDepth,
} from "@salimon/domain"
import type { Category, CategoryUsageType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Archive, Check, GripVertical, Pencil, Plus, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import type { DragEvent } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, IconButton, Input, Select } from "../styles"
import {
  CategoryIcon,
  CategoryUsageSelector,
  ColorPicker,
  categoryUsageOptions,
  hexColorPattern,
  iconOptions,
} from "./categoryEditorFields"

export interface CategoryListRowEditState {
  name: string
  icon: string
  color: string
  usageTypes: CategoryUsageType[]
  parentCategoryId: string
}

interface CategoryListRowProps {
  category: Category
  depth: CategoryDepth
  budgetValue: string | number
  editing: boolean
  editState: CategoryListRowEditState
  dndEnabled: boolean
  savingOrder: boolean
  isDragging: boolean
  isDragOver: boolean
  onBudgetChange: (value: string) => void
  onEditStart: () => void
  onEditChange: (changes: Partial<CategoryListRowEditState>) => void
  onEditSave: () => void
  onEditCancel: () => void
  onCreateChild: () => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
}

export const CategoryListRow = observer(function CategoryListRow({
  category,
  depth,
  budgetValue,
  editing,
  editState,
  dndEnabled,
  savingOrder,
  isDragging,
  isDragOver,
  onBudgetChange,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onCreateChild,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: CategoryListRowProps) {
  const store = useAppStore()
  const hasChildren = store.currentCategories.some(
    (item) => item.parentCategoryId === category.id,
  )

  return (
    <Row
      $isDragging={isDragging}
      $isDragOver={isDragOver}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <DragHandle
        type="button"
        title={
          dndEnabled ? "순서 변경" : "사용자 지정 순서에서만 변경할 수 있습니다"
        }
        aria-label={`${category.name} 순서 변경`}
        draggable={dndEnabled && !savingOrder}
        disabled={!dndEnabled || savingOrder}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={16} />
      </DragHandle>
      {editing ? (
        <CategoryEditor>
          <Input
            aria-label={`${category.name} 카테고리 이름`}
            value={editState.name}
            onChange={(event) => onEditChange({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") onEditSave()
              if (event.key === "Escape") onEditCancel()
            }}
          />
          <Select
            aria-label={`${category.name} 카테고리 아이콘`}
            value={editState.icon}
            onChange={(event) => onEditChange({ icon: event.target.value })}
          >
            {iconOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <ColorPicker
            value={editState.color}
            onChange={(color) => onEditChange({ color })}
            label={`${category.name} 카테고리`}
          />
          <CategoryUsageSelector
            value={editState.usageTypes}
            onChange={(usageTypes) => onEditChange({ usageTypes })}
            label="적용 용도"
          />
          <Select
            aria-label={`${category.name} 상위 카테고리`}
            value={editState.parentCategoryId}
            onChange={(event) =>
              onEditChange({ parentCategoryId: event.target.value })
            }
          >
            <option value="">최상위 카테고리</option>
            {store.currentCategories
              .filter((parent) =>
                canMoveCategoryUnder(
                  store.currentCategories,
                  category,
                  parent,
                  editState.usageTypes,
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
            value={formatMoneyInput(budgetValue)}
            onChange={(event) =>
              onBudgetChange(event.target.value.replace(/\D/g, ""))
            }
          />
          <Button
            $variant="soft"
            onClick={() =>
              void store.setCategoryBudget(
                category.id,
                Number(budgetValue || 0),
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
              onCreateChild()
              document.getElementById("category-create-name")?.focus()
            }}
          >
            <Plus size={15} />
          </IconButton>
        ) : null}
        {editing ? (
          <>
            <IconButton
              $variant="primary"
              title="카테고리 수정 저장"
              aria-label={`${category.name} 수정 저장`}
              disabled={
                !editState.name.trim() ||
                !hexColorPattern.test(editState.color) ||
                editState.usageTypes.length === 0
              }
              onClick={onEditSave}
            >
              <Check size={15} />
            </IconButton>
            <IconButton
              title="카테고리 수정 취소"
              aria-label={`${category.name} 수정 취소`}
              onClick={onEditCancel}
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
            onClick={onEditStart}
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
            hasChildren || category.name === "기타" || isSplitCategory(category)
          }
          onClick={() => void store.archiveCategory(category.id)}
        >
          <Archive size={15} />
        </IconButton>
      </CategoryActions>
    </Row>
  )
})

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

const Row = styled.div<{
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
