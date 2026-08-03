"use client"

import styled from "@emotion/styled"
import {
  formatMoneyInput,
  formatKrw,
  getCategoryLabel,
  isSplitCategory,
} from "@salimon/domain"
import type { CategoryUsageType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { ListPlus, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Button, Field, IconButton, Input, Select, Textarea } from "../styles"
import type {
  TransactionEditorDraft,
  TransactionSplitDraft,
} from "./transactionEditorDraft"

interface TransactionDetailsFieldsProps {
  draft: TransactionEditorDraft
  amount: number
  splits: TransactionSplitDraft[]
  splitsValid: boolean
  splitTotal: number
  tagsInput: string
  onDraftChange: (draft: TransactionEditorDraft) => void
  onSplitsChange: (splits: TransactionSplitDraft[]) => void
  onTagsInputChange: (value: string) => void
}

export const TransactionDetailsFields = observer(
  function TransactionDetailsFields({
    draft,
    amount,
    splits,
    splitsValid,
    splitTotal,
    tagsInput,
    onDraftChange,
    onSplitsChange,
    onTagsInputChange,
  }: TransactionDetailsFieldsProps) {
    const store = useAppStore()
    const isSalaryIncome =
      draft.type === "income" && draft.incomeKind === "salary"
    const merchantLabel = isSalaryIncome
      ? "회사명"
      : draft.type === "income" && draft.incomeKind === "side_income"
        ? "지급처/지급인"
        : "가맹점/내용"
    const splitCategorySelected = isSplitCategory(
      store.currentCategories.find(
        (category) => category.id === draft.categoryId,
      ),
    )
    const selectableCategories = store.currentCategories.filter((category) =>
      category.usageTypes.includes(draft.type as CategoryUsageType),
    )
    const splitSelectableCategories = selectableCategories.filter(
      (category) => !isSplitCategory(category),
    )
    const categoryLabel = (categoryId: string): string =>
      getCategoryLabel(store.currentCategories, categoryId, "삭제된 카테고리")

    return (
      <>
        <Field>
          {isSalaryIncome ? "근로자" : "행위자"}
          <Select
            value={draft.actorUserId}
            onChange={(event) =>
              onDraftChange({ ...draft, actorUserId: event.target.value })
            }
          >
            <option value="">공통</option>
            {store.currentMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.nickname}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          기준 카테고리
          <Select
            value={draft.categoryId}
            onChange={(event) => {
              const categoryId = event.target.value
              if (
                !isSplitCategory(
                  store.currentCategories.find(
                    (category) => category.id === categoryId,
                  ),
                )
              ) {
                onSplitsChange([])
              }
              onDraftChange({ ...draft, categoryId })
            }}
          >
            <option value="">기본 카테고리 자동 적용</option>
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(category.id)}
              </option>
            ))}
          </Select>
        </Field>

        {draft.recurringType === "none" && splitCategorySelected ? (
          <SplitSection>
            <SplitHeader>
              <span>
                <strong>카테고리 분할</strong>
                <small>여러 항목을 한 번에 결제했을 때 사용합니다.</small>
              </span>
              <Button
                type="button"
                disabled={
                  splits.length >= 10 || splitSelectableCategories.length === 0
                }
                onClick={() =>
                  onSplitsChange([
                    ...splits,
                    {
                      categoryId: splitSelectableCategories[0]?.id || "",
                      amount: "",
                    },
                  ])
                }
              >
                <ListPlus size={14} /> 항목 추가
              </Button>
            </SplitHeader>
            {splits.map((split, index) => (
              <SplitRow key={`${index}-${split.categoryId}`}>
                <Select
                  aria-label={`분할 ${index + 1} 카테고리`}
                  value={split.categoryId}
                  onChange={(event) =>
                    onSplitsChange(
                      splits.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, categoryId: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {splitSelectableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category.id)}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`분할 ${index + 1} 금액`}
                  inputMode="numeric"
                  value={formatMoneyInput(split.amount)}
                  onChange={(event) =>
                    onSplitsChange(
                      splits.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              amount: event.target.value.replace(/\D/g, ""),
                            }
                          : item,
                      ),
                    )
                  }
                />
                <IconButton
                  type="button"
                  title={`분할 ${index + 1} 삭제`}
                  onClick={() =>
                    onSplitsChange(
                      splits.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X size={15} />
                </IconButton>
              </SplitRow>
            ))}
            {splits.length > 0 ? (
              <SplitSummary $valid={splitsValid}>
                합계 {formatKrw(splitTotal)} / 거래 금액{" "}
                {formatKrw(amount || 0)}
                {!splitsValid ? " · 합계와 거래 금액을 맞춰 주세요." : ""}
              </SplitSummary>
            ) : null}
          </SplitSection>
        ) : null}

        <Field>
          {merchantLabel}
          <Input
            value={draft.merchantName}
            onChange={(event) =>
              onDraftChange({ ...draft, merchantName: event.target.value })
            }
          />
        </Field>

        <Field>
          메모
          <Textarea
            value={draft.memo}
            onChange={(event) =>
              onDraftChange({ ...draft, memo: event.target.value })
            }
          />
        </Field>

        {draft.recurringType === "none" ? (
          <Field>
            태그
            <Input
              value={tagsInput}
              maxLength={219}
              placeholder="예: 여행, 공동구매 (쉼표로 구분)"
              onChange={(event) => onTagsInputChange(event.target.value)}
            />
            <FieldHint>태그는 20자 이내로 최대 10개까지 저장됩니다.</FieldHint>
          </Field>
        ) : null}
      </>
    )
  },
)

const SplitSection = styled.section`
  display: grid;
  gap: 9px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  padding: 11px;
`

const SplitHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  > span {
    display: grid;
    gap: 2px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 400;
  }
`

const SplitRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(110px, 0.75fr) 34px;
  gap: 7px;
`

const SplitSummary = styled.small<{ $valid: boolean }>`
  color: ${({ $valid }) => ($valid ? colors.teal : colors.coral)};
  font-size: 11px;
  font-weight: 600;
`

const FieldHint = styled.small`
  color: ${colors.muted};
  font-size: 10px;
  line-height: 1.4;
`
