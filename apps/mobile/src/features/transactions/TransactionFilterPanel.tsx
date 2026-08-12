import styled from "@emotion/native"
import { getCategoryLabel } from "@salimon/domain"
import type { Category, LedgerMember } from "@salimon/types"
import { useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { mobileTheme } from "../../theme"
import { CategoryFilterModal } from "./CategoryFilterModal"
import type {
  MobileTransactionFilters,
  TransactionPeriod,
} from "./transactionPresentation"
import { toggleTransactionFilterValue } from "./transactionPresentation"

interface TransactionFilterPanelProps {
  categories: Category[]
  filters: MobileTransactionFilters
  members: LedgerMember[]
  onChange: (filters: MobileTransactionFilters) => void
  onReset: () => void
}

interface FilterOption<T extends string> {
  label: string
  value: T
}

const periodOptions: FilterOption<TransactionPeriod>[] = [
  { label: "이번 달", value: "all" },
  { label: "최근 7일", value: "7" },
  { label: "최근 14일", value: "14" },
  { label: "최근 28일", value: "28" },
]

const typeOptions: FilterOption<MobileTransactionFilters["type"]>[] = [
  { label: "전체", value: "" },
  { label: "지출", value: "expense" },
  { label: "수입", value: "income" },
  { label: "저축", value: "saving" },
]

const statusOptions: FilterOption<MobileTransactionFilters["status"]>[] = [
  { label: "전체", value: "" },
  { label: "확정", value: "confirmed" },
  { label: "합계 제외", value: "excluded" },
]

const structureOptions: FilterOption<MobileTransactionFilters["structure"]>[] =
  [
    { label: "전체", value: "" },
    { label: "일반", value: "regular" },
    { label: "고정", value: "fixed" },
    { label: "할부", value: "installment" },
    { label: "분할", value: "split" },
  ]

export function TransactionFilterPanel({
  categories,
  filters,
  members,
  onChange,
  onReset,
}: TransactionFilterPanelProps) {
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const selectedCategories = useMemo(
    () =>
      filters.categoryIds.flatMap((categoryId) => {
        const category = categoriesById.get(categoryId)
        return category ? [category] : []
      }),
    [categoriesById, filters.categoryIds],
  )
  const firstSelectedCategory = selectedCategories[0]
  const selectedCategoryLabel = firstSelectedCategory
    ? `${getCategoryLabel(categories, firstSelectedCategory.id)}${
        firstSelectedCategory.isArchived ? " · 보관됨" : ""
      }${selectedCategories.length > 1 ? ` 외 ${selectedCategories.length - 1}개` : ""}`
    : "전체 카테고리"
  const hasSelectedCategories = filters.categoryIds.length > 0

  return (
    <>
      <Panel>
        <PanelHeading>
          <PanelTitle>거래 필터</PanelTitle>
          <ResetButton accessibilityRole="button" onPress={onReset}>
            <ResetLabel>초기화</ResetLabel>
          </ResetButton>
        </PanelHeading>

        <FilterGroup
          defaultValue="all"
          label="기간"
          options={periodOptions}
          selectedValue={filters.period}
          onSelect={(period) => onChange({ ...filters, period })}
        />
        <FilterGroup
          defaultValue=""
          label="유형"
          options={typeOptions}
          selectedValue={filters.type}
          onSelect={(type) => onChange({ ...filters, type })}
        />
        <FilterGroup
          defaultValue=""
          label="상태"
          options={statusOptions}
          selectedValue={filters.status}
          onSelect={(status) => onChange({ ...filters, status })}
        />
        <FilterGroup
          defaultValue=""
          label="거래 형태"
          options={structureOptions}
          selectedValue={filters.structure}
          onSelect={(structure) => onChange({ ...filters, structure })}
        />

        <Group>
          <GroupLabel>카테고리</GroupLabel>
          <CategorySelector
            $selected={hasSelectedCategories}
            accessibilityHint="검색 가능한 카테고리 목록을 엽니다."
            accessibilityRole="button"
            onPress={() => setCategoryModalOpen(true)}
          >
            <CategorySelectorCopy>
              <CategorySelectorLabel $selected={hasSelectedCategories}>
                {selectedCategoryLabel}
              </CategorySelectorLabel>
              <CategorySelectorHint>
                {hasSelectedCategories
                  ? `${filters.categoryIds.length}개 선택 · 눌러서 변경`
                  : `${categories.length}개 중 검색하여 선택`}
              </CategorySelectorHint>
            </CategorySelectorCopy>
            <CategorySelectorAction>
              {hasSelectedCategories ? "변경" : "선택"}
            </CategorySelectorAction>
          </CategorySelector>
        </Group>

        <FilterGroup
          defaultValue=""
          label="거래자"
          options={[
            { label: "전체", value: "" },
            { label: "공통", value: "common" },
            ...members.map((member) => ({
              label: member.nickname,
              value: member.userId,
            })),
          ]}
          selectedValue={filters.actorUserId}
          onSelect={(actorUserId) => onChange({ ...filters, actorUserId })}
        />
      </Panel>

      {categoryModalOpen ? (
        <CategoryFilterModal
          categories={categories}
          selectedCategoryIds={filters.categoryIds}
          onApply={(categoryIds) => {
            onChange({ ...filters, categoryIds })
            setCategoryModalOpen(false)
          }}
          onClose={() => setCategoryModalOpen(false)}
        />
      ) : null}
    </>
  )
}

interface FilterGroupProps<T extends string> {
  defaultValue: T
  label: string
  onSelect: (value: T) => void
  options: FilterOption<T>[]
  selectedValue: T
}

function FilterGroup<T extends string>({
  defaultValue,
  label,
  onSelect,
  options,
  selectedValue,
}: FilterGroupProps<T>) {
  return (
    <Group>
      <GroupLabel>{label}</GroupLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={chipContentStyle}
      >
        {options.map((option) => {
          const selected = option.value === selectedValue
          return (
            <FilterChip
              key={`${label}-${option.value || "all"}`}
              $selected={selected}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() =>
                onSelect(
                  toggleTransactionFilterValue(
                    selectedValue,
                    option.value,
                    defaultValue,
                  ),
                )
              }
            >
              <FilterChipLabel $selected={selected} numberOfLines={1}>
                {option.label}
              </FilterChipLabel>
            </FilterChip>
          )
        })}
      </ScrollView>
    </Group>
  )
}

const chipContentStyle = { gap: 8, paddingRight: 8 } as const

const Panel = styled.View({
  gap: mobileTheme.spacing[4],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const PanelHeading = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const PanelTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "800",
})

const ResetButton = styled.Pressable({
  minHeight: 36,
  justifyContent: "center",
  paddingHorizontal: mobileTheme.spacing[2],
})

const ResetLabel = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})

const Group = styled.View({ gap: mobileTheme.spacing[2] })

const GroupLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "700",
})

const CategorySelector = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panelSubtle,
    paddingVertical: mobileTheme.spacing[3],
    paddingHorizontal: mobileTheme.spacing[4],
  }),
)

const CategorySelectorCopy = styled.View({ minWidth: 0, flex: 1 })

const CategorySelectorLabel = styled.Text<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  }),
)

const CategorySelectorHint = styled.Text({
  marginTop: mobileTheme.spacing[1],
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})

const CategorySelectorAction = styled.Text({
  flexShrink: 0,
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})

const FilterChip = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.round,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)

const FilterChipLabel = styled.Text<{ $selected: boolean }>(
  ({ $selected }) => ({
    maxWidth: 180,
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
    fontSize: 11,
    fontWeight: $selected ? "800" : "600",
  }),
)
