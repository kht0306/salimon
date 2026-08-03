"use client"

import styled from "@emotion/styled"
import {
  buildCategoryTree,
  formatMoneyInput,
  getCategoryDepth,
  getCategoryLabel,
  isSplitCategory,
  MAX_CATEGORY_DEPTH,
} from "@salimon/domain"
import type { CategoryUsageType } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import { Plus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  Input,
  PanelHeader,
  PanelTitle,
  RequiredMark,
  Select,
} from "../styles"
import {
  CategoryUsageSelector,
  ColorPicker,
  colorOptions,
  hexColorPattern,
  iconOptions,
} from "./categoryEditorFields"

interface CategoryCreateFormProps {
  parentCategoryId: string
  onParentCategoryChange: (categoryId: string) => void
}

export const CategoryCreateForm = observer(function CategoryCreateForm({
  parentCategoryId,
  onParentCategoryChange,
}: CategoryCreateFormProps) {
  const store = useAppStore()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(iconOptions[0].value)
  const [color, setColor] = useState(colorOptions[0])
  const [budget, setBudget] = useState("")
  const [usageTypes, setUsageTypes] = useState<CategoryUsageType[]>(["expense"])

  useEffect(() => {
    if (!parentCategoryId) return
    const parent = store.currentCategories.find(
      (category) => category.id === parentCategoryId,
    )
    if (parent) {
      setIcon(parent.icon)
      setColor(parent.color)
      setUsageTypes(parent.usageTypes)
    }
  }, [parentCategoryId, store])

  const selectedParent = parentCategoryId
    ? store.currentCategories.find(
        (category) => category.id === parentCategoryId,
      )
    : undefined
  const parentSelectionIsValid =
    !parentCategoryId ||
    Boolean(
      selectedParent &&
      !isSplitCategory(selectedParent) &&
      getCategoryDepth(store.currentCategories, selectedParent.id) <
        MAX_CATEGORY_DEPTH &&
      usageTypes.every((usageType) =>
        selectedParent.usageTypes.includes(usageType),
      ),
    )

  async function create() {
    if (
      await store.createCategory(
        name,
        icon,
        color,
        usageTypes,
        Number(budget || 0),
        parentCategoryId || undefined,
      )
    ) {
      setName("")
      setBudget("")
      onParentCategoryChange("")
    }
  }

  function selectParent(categoryId: string) {
    onParentCategoryChange(categoryId)
    const parent = store.currentCategories.find(
      (category) => category.id === categoryId,
    )
    if (parent) setUsageTypes(parent.usageTypes)
  }

  return (
    <>
      <PanelHeader>
        <PanelTitle>카테고리</PanelTitle>
        <Button
          $variant="primary"
          onClick={() => void create()}
          disabled={
            !name.trim() ||
            !store.authUser ||
            !hexColorPattern.test(color) ||
            usageTypes.length === 0 ||
            !parentSelectionIsValid
          }
        >
          <Plus size={16} /> 추가
        </Button>
      </PanelHeader>

      <CategoryComposer>
        <Field>
          <span>
            이름<RequiredMark>*</RequiredMark>
          </span>
          <Input
            id="category-create-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          상위 카테고리 (선택)
          <Select
            value={parentCategoryId}
            onChange={(event) => selectParent(event.target.value)}
          >
            <option value="">최상위 카테고리</option>
            {buildCategoryTree(store.currentCategories)
              .filter(
                ({ category, depth }) =>
                  depth < MAX_CATEGORY_DEPTH && !isSplitCategory(category),
              )
              .map(({ category }) => (
                <option
                  key={category.id}
                  value={category.id}
                  disabled={usageTypes.some(
                    (usageType) => !category.usageTypes.includes(usageType),
                  )}
                >
                  {getCategoryLabel(store.currentCategories, category.id)}
                </option>
              ))}
          </Select>
        </Field>
        <Field>
          <span>
            아이콘<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
          >
            {iconOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <CategoryUsageSelector
          value={usageTypes}
          onChange={setUsageTypes}
          label="적용 용도*"
        />
        {usageTypes.includes("expense") ? (
          <Field>
            {store.selectedMonth} 예산
            <Input
              inputMode="numeric"
              placeholder="선택 입력"
              value={formatMoneyInput(budget)}
              onChange={(event) =>
                setBudget(event.target.value.replace(/\D/g, ""))
              }
            />
          </Field>
        ) : (
          <ComposerSpacer />
        )}
        <ColorPicker
          value={color}
          onChange={setColor}
          label="새 카테고리"
          required
        />
      </CategoryComposer>
    </>
  )
})

const CategoryComposer = styled.div`
  display: grid;
  grid-template-columns:
    minmax(140px, 1fr) 140px 160px minmax(210px, auto)
    140px auto;
  gap: 12px;
  padding: 16px 18px;
  align-items: end;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const ComposerSpacer = styled.div``
