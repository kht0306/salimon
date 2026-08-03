"use client"

import styled from "@emotion/styled"
import type { CategoryUsageType, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Field, Input, RequiredMark, Select } from "../styles"
import {
  getIncomeRecurringType,
  getInstallmentPaymentMethodId,
  type TransactionEditorDraft,
  type TransactionSplitDraft,
} from "./transactionEditorDraft"

interface TransactionTypeFieldsProps {
  draft: TransactionEditorDraft
  editing: Transaction | null
  isEditingInstallment: boolean
  isEditingFixed: boolean
  onDraftChange: (draft: TransactionEditorDraft) => void
  onSplitsChange: (splits: TransactionSplitDraft[]) => void
  onTagsInputChange: (value: string) => void
}

export const TransactionTypeFields = observer(function TransactionTypeFields({
  draft,
  editing,
  isEditingInstallment,
  isEditingFixed,
  onDraftChange,
  onSplitsChange,
  onTagsInputChange,
}: TransactionTypeFieldsProps) {
  const store = useAppStore()
  const isEditingRecurring = isEditingFixed || isEditingInstallment

  return (
    <>
      <TwoColumns>
        <Field>
          <span>
            유형<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={draft.type}
            disabled={isEditingRecurring}
            onChange={(event) => {
              const type = event.target.value as Transaction["type"]
              onSplitsChange([])
              onDraftChange({
                ...draft,
                type,
                incomeKind: type === "income" ? "side_income" : undefined,
                categoryId:
                  store.currentCategories.find((category) =>
                    category.usageTypes.includes(type as CategoryUsageType),
                  )?.id ?? "",
                recurringType: "none",
                paymentMethodId:
                  type === "expense"
                    ? draft.paymentMethodId ||
                      store.currentUserPrimaryCard?.id ||
                      ""
                    : type === "saving"
                      ? store.currentAccounts.some(
                          (account) => account.id === draft.paymentMethodId,
                        )
                        ? draft.paymentMethodId
                        : store.currentAccounts[0]?.id || ""
                      : "",
              })
            }}
          >
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="saving">저축</option>
          </Select>
        </Field>
        <Field>
          <span>
            상태<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={draft.status}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                status: event.target.value as Transaction["status"],
              })
            }
          >
            <option value="confirmed">확정</option>
            <option value="excluded">제외</option>
          </Select>
        </Field>
      </TwoColumns>

      <TwoColumns>
        {draft.type === "income" ? (
          <Field>
            수입 유형
            <Select
              value={draft.incomeKind ?? "side_income"}
              disabled={isEditingFixed}
              onChange={(event) => {
                const incomeKind = event.target.value as
                  | "salary"
                  | "side_income"
                const recurringType = getIncomeRecurringType(incomeKind)
                if (recurringType === "fixed") {
                  onSplitsChange([])
                  onTagsInputChange("")
                }
                onDraftChange({ ...draft, incomeKind, recurringType })
              }}
            >
              <option value="salary">월급</option>
              <option value="side_income">부수입</option>
            </Select>
          </Field>
        ) : (
          <Field>
            반복 유형
            <Select
              value={draft.recurringType}
              disabled={isEditingRecurring}
              onChange={(event) => {
                const recurringType = event.target
                  .value as TransactionEditorDraft["recurringType"]
                if (recurringType !== "none") {
                  onSplitsChange([])
                  onTagsInputChange("")
                }
                onDraftChange({
                  ...draft,
                  recurringType,
                  paymentMethodId:
                    recurringType === "installment"
                      ? getInstallmentPaymentMethodId({
                          currentPaymentMethodId: draft.paymentMethodId,
                          activeCardIds: new Set(
                            store.currentCards.map((card) => card.id),
                          ),
                          primaryCardId: store.currentUserPrimaryCard?.id,
                        })
                      : draft.paymentMethodId,
                })
              }}
            >
              <option value="none">일반 거래</option>
              <option value="fixed">
                {draft.type === "saving" ? "정기저축" : "고정비"}
              </option>
              <option value="installment" disabled={draft.type !== "expense"}>
                카드 할부
              </option>
            </Select>
          </Field>
        )}
        {draft.type === "income" && draft.incomeKind === "side_income" ? (
          <IncomeRecurrenceCard
            as="label"
            $checked={draft.recurringType === "fixed"}
            $interactive
          >
            <input
              type="checkbox"
              checked={draft.recurringType === "fixed"}
              disabled={isEditingFixed}
              onChange={(event) => {
                const recurringType = getIncomeRecurringType(
                  "side_income",
                  event.target.checked,
                )
                if (recurringType === "fixed") {
                  onSplitsChange([])
                  onTagsInputChange("")
                }
                onDraftChange({ ...draft, recurringType })
              }}
            />
            <span>
              <strong>고정 수입</strong>
              <small>매월 같은 일자에 거래 생성</small>
            </span>
          </IncomeRecurrenceCard>
        ) : draft.type === "income" ? (
          <IncomeRecurrenceCard role="status">
            <span>월급은 매월 고정수입으로 등록됩니다.</span>
          </IncomeRecurrenceCard>
        ) : null}
        {draft.recurringType === "installment" ? (
          <Field>
            <span>
              할부 개월<RequiredMark>*</RequiredMark>
            </span>
            {editing?.recurringType === "installment"
              ? ` (${editing.installmentNumber ?? 1}/${draft.installmentMonths})`
              : ""}
            <Input
              required
              type="number"
              min="2"
              max="120"
              disabled={isEditingInstallment}
              value={draft.installmentMonths}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  installmentMonths: event.target.value,
                })
              }
            />
          </Field>
        ) : draft.type === "income" ? null : (
          <div />
        )}
      </TwoColumns>

      {isEditingInstallment ? (
        <EditPolicyNotice role="status">
          할부 거래는 거래 유형, 반복 유형, 할부 개월, 결제 수단, 거래일시를
          변경할 수 없습니다. 금액은 선택한 회차 기준으로 수정됩니다.
        </EditPolicyNotice>
      ) : isEditingFixed ? (
        <EditPolicyNotice role="status">
          고정 거래의 유형, 수입 유형, 반복 여부와 거래일시는 변경할 수
          없습니다. 반복 종료는 거래 목록의 종료 작업을 이용해 주세요.
        </EditPolicyNotice>
      ) : null}
    </>
  )
})

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`

const EditPolicyNotice = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  color: ${colors.muted};
  padding: 9px 10px;
  font-size: 11px;
  line-height: 1.5;
`

const IncomeRecurrenceCard = styled.div<{
  $checked?: boolean
  $interactive?: boolean
}>`
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid
    ${({ $checked }) => ($checked ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $checked }) => ($checked ? colors.tealSoft : colors.panel)};
  color: ${colors.ink};
  padding: 8px 11px;
  cursor: ${({ $interactive }) => ($interactive ? "pointer" : "default")};

  input {
    margin: 0;
    accent-color: ${colors.teal};
  }

  span {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 400;
  }
`
