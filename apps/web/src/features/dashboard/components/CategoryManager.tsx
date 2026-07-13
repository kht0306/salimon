"use client"

import styled from "@emotion/styled"
import { formatMoneyInput } from "@salimon/domain"
import type { Category, CategoryUsageType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Archive,
  BadgeDollarSign,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Bus,
  Car,
  Check,
  Circle,
  CircleDollarSign,
  CirclePlus,
  Coffee,
  Dumbbell,
  Ellipsis,
  Gift,
  GripVertical,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PartyPopper,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat2,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Ticket,
  Utensils,
  WalletCards,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react"
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
  { value: "shopping-basket", label: "생활" },
  { value: "home", label: "주거" },
  { value: "building-2", label: "주거비/관리비" },
  { value: "receipt-text", label: "공과금" },
  { value: "wifi", label: "통신" },
  { value: "smartphone", label: "휴대전화" },
  { value: "heart-pulse", label: "의료" },
  { value: "shield-check", label: "보험" },
  { value: "ticket", label: "문화/여가" },
  { value: "party-popper", label: "여가/모임" },
  { value: "repeat-2", label: "구독/멤버십" },
  { value: "book-open", label: "교육" },
  { value: "piggy-bank", label: "저축" },
  { value: "gift", label: "경조사/선물" },
  { value: "wallet-cards", label: "용돈" },
  { value: "hand-coins", label: "수입/지원금" },
  { value: "landmark", label: "금융/이자" },
  { value: "circle-dollar-sign", label: "금액/정산" },
  { value: "badge-dollar-sign", label: "급여" },
  { value: "car", label: "차량" },
  { value: "dumbbell", label: "운동/건강" },
  { value: "more-horizontal", label: "기타" },
]
const iconLabels = Object.fromEntries(
  iconOptions.map((option) => [option.value, option.label]),
)
const categoryIconComponents: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  home: House,
  "building-2": Building2,
  "receipt-text": ReceiptText,
  wifi: Wifi,
  smartphone: Smartphone,
  "heart-pulse": HeartPulse,
  "shield-check": ShieldCheck,
  ticket: Ticket,
  "party-popper": PartyPopper,
  "repeat-2": Repeat2,
  "book-open": BookOpen,
  "piggy-bank": PiggyBank,
  gift: Gift,
  "wallet-cards": WalletCards,
  "hand-coins": HandCoins,
  landmark: Landmark,
  "circle-dollar-sign": CircleDollarSign,
  "badge-dollar-sign": BadgeDollarSign,
  car: Car,
  dumbbell: Dumbbell,
  "more-horizontal": Ellipsis,
  ellipsis: Ellipsis,
  "briefcase-business": BriefcaseBusiness,
  "circle-plus": CirclePlus,
}
const hexColorPattern = /^#[0-9a-f]{6}$/i
type CategorySortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "budget-asc"
  | "budget-desc"
type CategoryUsageFilter = "all" | CategoryUsageType

const categoryUsageOptions: Array<{
  value: CategoryUsageType
  label: string
}> = [
  { value: "expense", label: "지출용" },
  { value: "income", label: "수입용" },
  { value: "saving", label: "저축용" },
]

function toggleUsageType(
  current: CategoryUsageType[],
  usageType: CategoryUsageType,
): CategoryUsageType[] {
  return current.includes(usageType)
    ? current.filter((item) => item !== usageType)
    : [...current, usageType]
}

function CategoryUsageSelector({
  value,
  onChange,
  label,
}: {
  value: CategoryUsageType[]
  onChange: (value: CategoryUsageType[]) => void
  label: string
}) {
  return (
    <UsageField>
      <span>{label}</span>
      <UsageOptions>
        {categoryUsageOptions.map((option) => (
          <UsageOption
            key={option.value}
            type="button"
            $selected={value.includes(option.value)}
            aria-pressed={value.includes(option.value)}
            onClick={() => onChange(toggleUsageType(value, option.value))}
          >
            {option.label}
          </UsageOption>
        ))}
      </UsageOptions>
    </UsageField>
  )
}

function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = categoryIconComponents[icon] ?? Circle

  return (
    <CategoryIconBadge $color={color} aria-hidden="true">
      <Icon size={15} strokeWidth={2.2} />
    </CategoryIconBadge>
  )
}

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

const CategoryCreateForm = observer(function CategoryCreateForm() {
  const store = useAppStore()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(iconOptions[0].value)
  const [color, setColor] = useState(colorOptions[0])
  const [budget, setBudget] = useState("")
  const [usageTypes, setUsageTypes] = useState<CategoryUsageType[]>(["expense"])

  async function create() {
    if (
      await store.createCategory(
        name,
        icon,
        color,
        usageTypes,
        Number(budget || 0),
      )
    ) {
      setName("")
      setBudget("")
    }
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
            usageTypes.length === 0
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
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
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

export const CategoryManager = observer(function CategoryManager() {
  const store = useAppStore()
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState(iconOptions[0].value)
  const [editColor, setEditColor] = useState(colorOptions[0])
  const [editUsageTypes, setEditUsageTypes] = useState<CategoryUsageType[]>([])
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
  const visibleCategories = store.currentCategories
    .filter(
      (category) =>
        usageFilter === "all" || category.usageTypes.includes(usageFilter),
    )
    .filter((category) =>
      normalizedQuery
        ? `${category.name} ${iconLabels[category.icon] ?? category.icon}`
            .toLocaleLowerCase("ko-KR")
            .includes(normalizedQuery)
        : true,
    )
    .sort((first, second) => {
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
    })

  function startEditing(category: Category) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditIcon(category.icon)
    setEditColor(category.color)
    setEditUsageTypes(category.usageTypes)
  }

  async function saveEditing() {
    if (!editingId) return
    if (
      await store.updateCategory(editingId, {
        name: editName,
        icon: editIcon,
        color: editColor,
        usageTypes: editUsageTypes,
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

    setSavingOrder(true)
    try {
      await store.reorderCategories(sourceCategoryId, categoryId)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <Panel>
      <CategoryCreateForm />

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
        {visibleCategories.map((category) => (
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
              </CategoryEditor>
            ) : (
              <CategorySummary>
                <CategoryIcon icon={category.icon} color={category.color} />
                <CategoryInfo>
                  <strong>{category.name}</strong>
                  <span>
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
        {visibleCategories.length === 0 ? (
          <EmptyCategoryList>검색 결과가 없습니다.</EmptyCategoryList>
        ) : null}
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
  grid-template-columns: minmax(140px, 1fr) 140px minmax(210px, auto) 140px auto;
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

const UsageField = styled.div`
  display: grid;
  gap: 8px;
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 600;
`

const UsageOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`

const UsageOption = styled.button<{ $selected: boolean }>`
  min-height: 32px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.borderStrong)};
  border-radius: ${radii.sm};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.muted)};
  padding: 0 9px;
  font-size: 12px;
  font-weight: 650;
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

const CategorySummary = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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

const CategoryIconBadge = styled.span<{ $color: string }>`
  width: 30px;
  height: 30px;
  display: inline-grid;
  flex: 0 0 30px;
  place-items: center;
  border-radius: ${radii.round};
  background: ${({ $color }) => `color-mix(in srgb, ${$color} 14%, white)`};
  color: ${({ $color }) => $color};
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
