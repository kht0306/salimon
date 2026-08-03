"use client"

import styled from "@emotion/styled"
import type { CategoryUsageType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  BadgeDollarSign,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Bus,
  Car,
  Circle,
  CircleDollarSign,
  CirclePlus,
  Coffee,
  Dumbbell,
  Ellipsis,
  Gift,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PartyPopper,
  PiggyBank,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Ticket,
  Utensils,
  WalletCards,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { Input, RequiredMark } from "../styles"

export const colorOptions = [
  "#2d6a4f",
  "#e4572e",
  "#277da1",
  "#f4a261",
  "#7b2cbf",
  "#6c757d",
]
export const iconOptions = [
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
export const iconLabels = Object.fromEntries(
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
export const hexColorPattern = /^#[0-9a-f]{6}$/i
export const categoryUsageOptions: Array<{
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

export function CategoryUsageSelector({
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

export function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = categoryIconComponents[icon] ?? Circle

  return (
    <CategoryIconBadge $color={color} aria-hidden="true">
      <Icon size={15} strokeWidth={2.2} />
    </CategoryIconBadge>
  )
}

export function ColorPicker({
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
  background: ${colors.panel};
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
  border: 2px solid
    ${({ $selected }) => ($selected ? colors.ink : colors.panel)};
  outline: 1px solid ${colors.border};
  background: ${({ $color }) => $color};
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
