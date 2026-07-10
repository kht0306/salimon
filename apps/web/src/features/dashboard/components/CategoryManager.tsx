"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import { Archive, Plus, Save } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Field, IconButton, Input, Panel, PanelHeader, PanelTitle, Select } from "../styles"

const colorOptions = ["#2d6a4f", "#e4572e", "#277da1", "#f4a261", "#7b2cbf", "#6c757d"]
const iconOptions = [
  { value: "utensils", label: "식비" },
  { value: "coffee", label: "카페" },
  { value: "bus", label: "교통" },
  { value: "shopping-bag", label: "쇼핑" },
  { value: "home", label: "주거" },
  { value: "more-horizontal", label: "기타" },
]
const iconLabels = Object.fromEntries(iconOptions.map((option) => [option.value, option.label]))

export const CategoryManager = observer(function CategoryManager() {
  const store = useAppStore()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(iconOptions[0].value)
  const [color, setColor] = useState(colorOptions[0])

  async function create() {
    if (await store.createExpenseCategory(name, icon, color)) {
      setName("")
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>지출 카테고리</PanelTitle>
        <Button $variant="primary" onClick={() => void create()} disabled={!name.trim() || !store.authUser}>
          <Plus size={16} /> 추가
        </Button>
      </PanelHeader>

      <CategoryComposer>
        <Field>
          이름
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          아이콘
          <Select value={icon} onChange={(event) => setIcon(event.target.value)}>
            {iconOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Swatches>
          {colorOptions.map((option) => (
            <Swatch
              key={option}
              type="button"
              title={option}
              $color={option}
              $selected={color === option}
              onClick={() => setColor(option)}
            />
          ))}
        </Swatches>
      </CategoryComposer>

      <CategoryList>
        {store.expenseCategories.map((category) => (
          <CategoryRow key={category.id}>
            <ColorDot $color={category.color} />
            <CategoryInfo>
              <strong>{category.name}</strong>
              <span>{category.isDefault ? "기본" : "사용자"} · {iconLabels[category.icon] ?? category.icon}</span>
            </CategoryInfo>
            <IconButton
              title="색상 저장"
              aria-label={`${category.name} 색상 저장`}
              onClick={() => void store.updateCategory(category.id, { color: category.color })}
            >
              <Save size={15} />
            </IconButton>
            <IconButton
              $variant="danger"
              title="카테고리 비활성화"
              aria-label={`${category.name} 비활성화`}
              disabled={category.isDefault || category.name === "기타"}
              onClick={() => void store.archiveCategory(category.id)}
            >
              <Archive size={15} />
            </IconButton>
          </CategoryRow>
        ))}
      </CategoryList>
    </Panel>
  )
})

const CategoryComposer = styled.div`
  display: grid;
  grid-template-columns: 1fr 180px auto;
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

const CategoryRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;
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
