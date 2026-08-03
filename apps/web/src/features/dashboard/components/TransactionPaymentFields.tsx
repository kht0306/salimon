"use client"

import styled from "@emotion/styled"
import {
  formatKoreanDate,
  formatMoneyInput,
  formatKrw,
  splitInstallmentPrincipal,
} from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Field, Input, RequiredMark, Select } from "../styles"
import { buildInstallmentSchedulePreview } from "./installmentSchedule"
import type { TransactionEditorDraft } from "./transactionEditorDraft"
import {
  getPaymentMethodTypeLabel,
  sortPaymentMethodsForSelection,
} from "./transactionPresentation"

interface TransactionPaymentFieldsProps {
  draft: TransactionEditorDraft
  editing: Transaction | null
  isEditingInstallment: boolean
  isEditingFixed: boolean
  onDraftChange: (draft: TransactionEditorDraft) => void
}

export const TransactionPaymentFields = observer(
  function TransactionPaymentFields({
    draft,
    editing,
    isEditingInstallment,
    isEditingFixed,
    onDraftChange,
  }: TransactionPaymentFieldsProps) {
    const store = useAppStore()
    const isEditingRecurring = isEditingFixed || isEditingInstallment
    const amount = Number(draft.amount)
    const installmentMonths = Number(draft.installmentMonths)
    const installmentAmounts =
      draft.recurringType === "installment" &&
      draft.installmentAmountType === "principal" &&
      Number.isSafeInteger(amount) &&
      Number.isSafeInteger(installmentMonths) &&
      installmentMonths > 0
        ? splitInstallmentPrincipal(amount, installmentMonths)
        : []
    const installmentMonthlyAmount = installmentAmounts[0] ?? amount
    const [transactionDate = "", transactionTimeValue = "12:00"] =
      draft.transactionAt.split("T")
    const transactionTime = transactionTimeValue.slice(0, 5)
    const installmentCard = store.currentCards.find(
      (card) => card.id === draft.paymentMethodId,
    )
    const installmentSchedule = buildInstallmentSchedulePreview({
      purchaseDate: transactionDate,
      paymentDay: installmentCard?.paymentDay,
      installmentMonths,
    })
    const installmentScheduleSummary =
      installmentSchedule.length <= 4
        ? installmentSchedule
        : installmentSchedule.filter(
            (_, index) => index < 3 || index === installmentSchedule.length - 1,
          )

    return (
      <>
        {draft.type === "expense" || draft.type === "saving" ? (
          <Field>
            <span>
              {draft.type === "saving" ? "거래 수단" : "결제 수단"}
              {draft.type === "saving" ||
              draft.recurringType === "installment" ? (
                <RequiredMark>*</RequiredMark>
              ) : null}
            </span>
            <Select
              required={
                draft.type === "saving" || draft.recurringType === "installment"
              }
              value={draft.paymentMethodId}
              disabled={isEditingInstallment}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  paymentMethodId: event.target.value,
                })
              }
            >
              <option value="">
                {draft.type === "saving"
                  ? "계좌를 선택해 주세요"
                  : draft.recurringType === "installment"
                    ? "카드를 선택해 주세요"
                    : "현금"}
              </option>
              {store.currentMembers.map((member) => {
                const memberMethods = sortPaymentMethodsForSelection(
                  (draft.type === "saving"
                    ? store.currentAccounts
                    : draft.recurringType === "installment"
                      ? store.currentCards
                      : store.currentPaymentMethods
                  ).filter((method) => method.ownerUserId === member.userId),
                )
                return memberMethods.length > 0 ? (
                  <optgroup key={member.userId} label={member.nickname}>
                    {memberMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {`${method.isPrimary ? "[주 카드] " : ""}[${getPaymentMethodTypeLabel(method)}] ${method.issuer} · ${method.name}${method.last4 ? ` (${method.last4})` : ""}`}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </Select>
            {draft.recurringType === "installment" &&
            store.currentCards.length === 0 ? (
              <CardRequired role="alert">
                내 카드 메뉴에서 카드를 먼저 등록하고 가계부에 연결해 주세요.
              </CardRequired>
            ) : draft.recurringType === "installment" &&
              draft.paymentMethodId &&
              !installmentCard?.paymentDay ? (
              <CardRequired role="alert">
                선택한 카드에 결제일을 먼저 등록해 주세요.
              </CardRequired>
            ) : null}
            {draft.type === "saving" && store.currentAccounts.length === 0 ? (
              <CardRequired role="alert">
                내 계좌 메뉴에서 계좌를 먼저 등록하고 가계부에 연결해 주세요.
              </CardRequired>
            ) : null}
          </Field>
        ) : null}

        <Field>
          <span>
            금액
            <RequiredMark>*</RequiredMark>
          </span>
          <AmountControl
            $withType={
              draft.recurringType === "installment" && !isEditingInstallment
            }
          >
            {draft.recurringType === "installment" && !isEditingInstallment ? (
              <Select
                aria-label="할부 금액 입력 방식"
                value={draft.installmentAmountType}
                disabled={isEditingInstallment}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    installmentAmountType: event.target.value as
                      | "monthly"
                      | "principal",
                  })
                }
              >
                <option value="monthly">월별 납입액</option>
                <option value="principal">할부 원금</option>
              </Select>
            ) : null}
            <Input
              required
              type="text"
              inputMode="numeric"
              pattern="[0-9,]*"
              autoComplete="off"
              value={formatMoneyInput(draft.amount)}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  amount: event.target.value.replace(/\D/g, ""),
                })
              }
            />
          </AmountControl>
          {isEditingInstallment ? (
            <InstallmentPreview>
              선택한 {editing?.installmentNumber ?? 1}회차 거래 금액
            </InstallmentPreview>
          ) : draft.recurringType === "installment" &&
            draft.installmentAmountType === "principal" &&
            installmentMonthlyAmount > 0 ? (
            <InstallmentPreview>
              월 {formatKrw(installmentMonthlyAmount)} · 마지막 회차에 잔액 반영
            </InstallmentPreview>
          ) : null}
        </Field>

        {isEditingFixed || isEditingInstallment ? (
          <FutureAmountScope $checked={draft.applyChangesToFuture}>
            <input
              type="checkbox"
              checked={draft.applyChangesToFuture}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  applyChangesToFuture: event.target.checked,
                })
              }
            />
            <span>
              <strong>
                {isEditingFixed
                  ? "변경 내용을 이 달 이후 거래에도 적용"
                  : "변경 금액을 이 달 이후 거래에도 적용"}
              </strong>
              <small>
                {draft.applyChangesToFuture
                  ? "이전 달 거래는 유지하고 선택한 달부터 반영합니다."
                  : isEditingFixed
                    ? "선택한 달의 거래만 수정합니다."
                    : "선택한 달의 거래 금액만 수정합니다."}
              </small>
            </span>
          </FutureAmountScope>
        ) : null}

        <Field>
          <span>
            {draft.recurringType === "installment"
              ? "카드 구매일시"
              : "거래일시"}
            <RequiredMark>*</RequiredMark>
          </span>
          <DateTimeInputs>
            <Input
              required
              type="date"
              aria-label="거래 날짜"
              disabled={isEditingRecurring}
              value={transactionDate}
              onChange={(event) => {
                onDraftChange({
                  ...draft,
                  transactionAt: `${event.target.value}T${transactionTime}`,
                })
              }}
            />
            <Input
              required
              type="time"
              aria-label="거래 시간"
              disabled={isEditingRecurring}
              value={transactionTime}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  transactionAt: `${transactionDate}T${event.target.value}`,
                })
              }
            />
          </DateTimeInputs>
        </Field>

        {draft.recurringType === "installment" &&
        !isEditingInstallment &&
        installmentScheduleSummary.length > 0 ? (
          <InstallmentScheduleCard>
            <strong>할부 일정</strong>
            <small>
              1회차는 구매일에 반영하고, 다음 달부터 카드 결제일에 반영합니다.
            </small>
            <InstallmentScheduleList>
              {installmentScheduleSummary.map((item, index) => (
                <li key={item.installmentNumber}>
                  <span>
                    {item.installmentNumber}/{installmentMonths}회
                  </span>
                  <strong>{formatKoreanDate(item.date)}</strong>
                  <small>
                    {item.installmentNumber === 1
                      ? "구매일 반영"
                      : "카드 결제 예정"}
                  </small>
                  {index === 2 && installmentSchedule.length > 4 ? (
                    <ScheduleEllipsis aria-hidden="true">···</ScheduleEllipsis>
                  ) : null}
                </li>
              ))}
            </InstallmentScheduleList>
          </InstallmentScheduleCard>
        ) : null}
      </>
    )
  },
)

const CardRequired = styled.span`
  color: ${colors.coral};
  font-size: 12px;
  font-weight: 600;
`

const AmountControl = styled.div<{ $withType: boolean }>`
  display: grid;
  grid-template-columns: ${({ $withType }) =>
    $withType ? "minmax(120px, 0.8fr) minmax(0, 1.2fr)" : "minmax(0, 1fr)"};
  gap: 8px;
`

const DateTimeInputs = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(110px, 0.55fr);
  gap: 8px;
`

const InstallmentPreview = styled.small`
  color: ${colors.teal};
  font-size: 11px;
  font-weight: 600;
`

const InstallmentScheduleCard = styled.section`
  display: grid;
  gap: 9px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  padding: 11px;

  > strong {
    font-size: 12px;
  }

  > small {
    color: ${colors.muted};
    font-size: 10px;
    line-height: 1.45;
  }
`

const InstallmentScheduleList = styled.ul`
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    border-top: 1px solid ${colors.border};
    padding-top: 6px;
    font-size: 11px;
  }

  li > span {
    color: ${colors.teal};
    font-weight: 700;
  }

  li > small {
    color: ${colors.muted};
  }
`

const ScheduleEllipsis = styled.span`
  position: absolute;
  left: 18px;
  bottom: -13px;
  color: ${colors.subtle};
`

const FutureAmountScope = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border: 1px solid
    ${({ $checked }) => ($checked ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $checked }) => ($checked ? colors.tealSoft : colors.panel)};
  color: ${colors.ink};
  padding: 10px 11px;
  cursor: pointer;

  input {
    margin: 2px 0 0;
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
    line-height: 1.45;
  }
`
