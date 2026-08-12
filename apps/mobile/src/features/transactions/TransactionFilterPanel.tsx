import styled from "@emotion/native"
import { getCategoryLabel } from "@salimon/domain"
import type { Category, LedgerMember } from "@salimon/types"
import { ScrollView } from "react-native"
import { mobileTheme } from "../../theme"
import type {
  MobileTransactionFilters,
  TransactionPeriod,
} from "./transactionPresentation"

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

export function TransactionFilterPanel({
  categories,
  filters,
  members,
  onChange,
  onReset,
}: TransactionFilterPanelProps) {
  return (
    <Panel>
      <PanelHeading>
        <PanelTitle>거래 필터</PanelTitle>
        <ResetButton accessibilityRole="button" onPress={onReset}>
          <ResetLabel>초기화</ResetLabel>
        </ResetButton>
      </PanelHeading>

      <FilterGroup
        label="기간"
        options={periodOptions}
        selectedValue={filters.period}
        onSelect={(period) => onChange({ ...filters, period })}
      />
      <FilterGroup
        label="유형"
        options={typeOptions}
        selectedValue={filters.type}
        onSelect={(type) => onChange({ ...filters, type })}
      />
      <FilterGroup
        label="상태"
        options={statusOptions}
        selectedValue={filters.status}
        onSelect={(status) => onChange({ ...filters, status })}
      />
      <FilterGroup
        label="카테고리"
        options={[
          { label: "전체", value: "" },
          ...categories.map((category) => ({
            label: `${getCategoryLabel(categories, category.id)}${
              category.isArchived ? " · 보관됨" : ""
            }`,
            value: category.id,
          })),
        ]}
        selectedValue={filters.categoryId}
        onSelect={(categoryId) => onChange({ ...filters, categoryId })}
      />
      <FilterGroup
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
  )
}

interface FilterGroupProps<T extends string> {
  label: string
  onSelect: (value: T) => void
  options: FilterOption<T>[]
  selectedValue: T
}

function FilterGroup<T extends string>({
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
              onPress={() => onSelect(option.value)}
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
