"use client"

import styled from "@emotion/styled"
import { formatMoneyInput } from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { Archive, Check, GripVertical, Pencil, Plus, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { type DragEvent, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  IconButton,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  RequiredMark,
  Select,
} from "../styles"

const colorOptions = [
  "#2d6a4f",
  "#e4572e",
  "#277da1",
  "#f4a261",
  "#7b2cbf",
  "#6c757d",
]
const iconOptions = [
  { value: "utensils", label: "식비" },
  { value: "coffee", label: "카페" },
  { value: "bus", label: "교통" },
  { value: "shopping-bag", label: "쇼핑" },
  { value: "home", label: "주거" },
  { value: "wifi", label: "통신" },
  { value: "heart-pulse", label: "의료" },
  { value: "ticket", label: "문화/여가" },
  { value: "book-open", label: "교육" },
  { value: "more-horizontal", label: "기타" },
]
const iconLabels = Object.fromEntries(
  iconOptions.map((option) => [option.value, option.label]),
)
const hexColorPattern = /^#[0-9a-f]{6}$/i

function ColorPicker({
  value,
  onChange,
  label,
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  required?: boolean
}) {
  const validColor = hexColorPattern.test(value) ? value : "#000000"

  return (
    <ColorPickerField>
      <span>색상{required ? <RequiredMark>*</RequiredMark> : null}</span>
      <ColorControls>
        <Swatches aria-label={`${label} 빠른 색상 선택`}>
          {colorOptions.map((option) => (
            <Swatch
              key={option}
              type="button"
              title={option}
              aria-label={option}
              $color={option}
              $selected={value.toLowerCase() === option}
              onClick={() => onChange(option)}
            />
          ))}
        </Swatches>
        <CustomColor>
          <NativeColorInput
            type="color"
            title="전체 색상에서 선택"
            aria-label={`${label} 전체 색상에서 선택`}
            value={validColor}
            onChange={(event) => onChange(event.target.value)}
          />
          <HexInput
            required={required}
            aria-label={`${label} HEX 색상 코드`}
            aria-invalid={!hexColorPattern.test(value)}
            maxLength={7}
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="#2d6a4f"
          />
        </CustomColor>
      </ColorControls>
    </ColorPickerField>
  )
}

export const CategoryManager = observer(function CategoryManager() {
  const store = useAppStore()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(iconOptions[0].value)
  const [color, setColor] = useState(colorOptions[0])
  const [budget, setBudget] = useState("")
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState(iconOptions[0].value)
  const [editColor, setEditColor] = useState(colorOptions[0])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  async function create() {
    if (
      await store.createExpenseCategory(
        name,
        icon,
        color,
        Number(budget || 0),
      )
    ) {
      setName("")
      setBudget("")
    }
  }

  function startEditing(category: (typeof store.expenseCategories)[number]) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditIcon(category.icon)
    setEditColor(category.color)
  }

  async function saveEditing() {
    if (!editingId) return
    if (
      await store.updateCategory(editingId, {
        name: editName,
        icon: editIcon,
        color: editColor,
      })
    ) {
      setEditingId(null)
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    categoryId: string,
  ) {
    if (savingOrder) return

    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", categoryId)
    setDraggingId(categoryId)
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    if (!draggingId || draggingId === categoryId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverId(categoryId)
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }

    setDragOverId((current) => (current === categoryId ? null : current))
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    categoryId: string,
  ) {
    event.preventDefault()
    const sourceCategoryId =
      draggingId || event.dataTransfer.getData("text/plain")

    setDraggingId(null)
    setDragOverId(null)
    if (!sourceCategoryId || sourceCategoryId === categoryId) return

    setSavingOrder(true)
    try {
      await store.reorderExpenseCategories(sourceCategoryId, categoryId)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>지출 카테고리</PanelTitle>
        <Button
          $variant="primary"
          onClick={() => void create()}
          disabled={
            !name.trim() || !store.authUser || !hexColorPattern.test(color)
          }
        >
          <Plus size={16} /> 추가
        </Button>
      </PanelHeader>

      <CategoryComposer>
        <Field>
          <span>이름<RequiredMark>*</RequiredMark></span>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <span>아이콘<RequiredMark>*</RequiredMark></span>
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
        <ColorPicker
          value={color}
          onChange={setColor}
          label="새 카테고리"
          required
        />
      </CategoryComposer>

      <CategoryList>
        {store.expenseCategories.map((category) => (
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
              title="순서 변경"
              aria-label={`${category.name} 순서 변경`}
              draggable={!savingOrder}
              disabled={savingOrder}
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
              </CategoryEditor>
            ) : (
              <CategorySummary>
                <ColorDot $color={category.color} />
                <CategoryInfo>
                  <strong>{category.name}</strong>
                  <span>
                    {category.isDefault ? "기본" : "사용자"} ·{" "}
                    {iconLabels[category.icon] ?? category.icon}
                  </span>
                </CategoryInfo>
              </CategorySummary>
            )}
            <BudgetField>
              <Input
                aria-label={`${category.name} ${store.selectedMonth} 예산`}
                inputMode="numeric"
                placeholder="월 예산"
                value={formatMoneyInput(
                  budgets[category.id] ??
                    store.selectedMonthBudgets.find(
                      (item) => item.category.id === category.id,
                    )?.amount ??
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
                        store.selectedMonthBudgets.find(
                          (item) => item.category.id === category.id,
                        )?.amount ??
                        0,
                    ),
                  )
                }
              >
                예산 저장
              </Button>
            </BudgetField>
            <CategoryActions>
              {editingId === category.id ? (
                <>
                  <IconButton
                    $variant="primary"
                    title="카테고리 수정 저장"
                    aria-label={`${category.name} 수정 저장`}
                    disabled={
                      !editName.trim() || !hexColorPattern.test(editColor)
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
                  title="카테고리 수정"
                  aria-label={`${category.name} 수정`}
                  onClick={() => startEditing(category)}
                >
                  <Pencil size={15} />
                </IconButton>
              )}
              <IconButton
                $variant="danger"
                title={
                  category.name === "기타"
                    ? "기타 카테고리는 제거할 수 없습니다"
                    : "카테고리 제거"
                }
                aria-label={`${category.name} 제거`}
                disabled={category.name === "기타"}
                onClick={() => void store.archiveCategory(category.id)}
              >
                <Archive size={15} />
              </IconButton>
            </CategoryActions>
          </CategoryRow>
        ))}
      </CategoryList>

      <RecurringSection>
        <strong>고정비 관리 ({store.selectedMonth})</strong>
        {store.data.recurringRules
          .filter(
            (rule) =>
              rule.ledgerId === store.selectedLedgerId &&
              rule.type === "fixed" &&
              (!rule.inactiveFromMonth ||
                rule.inactiveFromMonth > store.selectedMonth),
          )
          .map((rule) => (
            <RecurringRow key={rule.id}>
              <span>
                {rule.merchantName || rule.memo || "고정비"} ·{" "}
                {rule.amount.toLocaleString("ko-KR")}원 · 매월 {rule.dayOfMonth}
                일
              </span>
              <Button
                $variant="danger"
                onClick={() => void store.deactivateFixedRule(rule.id)}
              >
                이번 달부터 해제
              </Button>
            </RecurringRow>
          ))}
      </RecurringSection>
    </Panel>
  )
})

const CategoryComposer = styled.div`
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 150px 150px auto;
  gap: 12px;
  padding: 16px 18px;
  align-items: end;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const Swatches = styled.div`
  display: flex;
  gap: 6px;
  min-height: 38px;
  align-items: center;
`

const ColorPickerField = styled.div`
  display: grid;
  gap: 8px;
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 600;
`

const ColorControls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  @media (max-width: 720px) {
    flex-wrap: wrap;
  }
`

const CustomColor = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const NativeColorInput = styled.input`
  width: 38px;
  height: 38px;
  padding: 3px;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  background: #fff;
  cursor: pointer;
`

const HexInput = styled(Input)`
  width: 90px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-transform: lowercase;

  &[aria-invalid="true"] {
    border-color: ${colors.coral};
  }
`

const Swatch = styled.button<{ $color: string; $selected: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: ${radii.xs};
  border: 2px solid ${({ $selected }) => ($selected ? colors.ink : "#fff")};
  outline: 1px solid ${colors.border};
  background: ${({ $color }) => $color};
`

const CategoryList = styled.div`
  display: grid;
  padding: 4px 18px 12px;
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
    cursor: progress;
    opacity: 0.45;
  }
`

const CategorySummary = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

const CategoryEditor = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 110px minmax(300px, auto);
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

const RecurringSection = styled.div`
  display: grid;
  gap: 10px;
  padding: 18px;
  border-top: 1px solid ${colors.border};
`

const RecurringRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: ${colors.muted};
  font-size: 13px;
`

const ColorDot = styled.span<{ $color: string }>`
  width: 14px;
  height: 14px;
  border-radius: ${radii.round};
  background: ${({ $color }) => $color};
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
