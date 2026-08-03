"use client"

import styled from "@emotion/styled"
import { getCategoryLabel } from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Field, Input, Select } from "../styles"
import type { PeriodPreset } from "./transactionListRange"

interface TransactionListFiltersProps {
  period: PeriodPreset
  startDate: string
  endDate: string
  type: string
  status: string
  categoryId: string
  actorUserId: string
  paymentMethodIds: string[]
  keyword: string
  onPeriodChange: (period: PeriodPreset) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onTypeChange: (type: string) => void
  onStatusChange: (status: string) => void
  onCategoryIdChange: (categoryId: string) => void
  onActorUserIdChange: (actorUserId: string) => void
  onTogglePaymentMethod: (paymentMethodId: string) => void
  onKeywordChange: (keyword: string) => void
}

export const TransactionListFilters = observer(function TransactionListFilters({
  period,
  startDate,
  endDate,
  type,
  status,
  categoryId,
  actorUserId,
  paymentMethodIds,
  keyword,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onTypeChange,
  onStatusChange,
  onCategoryIdChange,
  onActorUserIdChange,
  onTogglePaymentMethod,
  onKeywordChange,
}: TransactionListFiltersProps) {
  const store = useAppStore()
  const paymentMethods = store.data.paymentMethods.filter(
    (method) => method.ledgerId === store.selectedLedgerId,
  )

  return (
    <Filters>
      <Field>
        기간
        <Select
          value={period}
          onChange={(event) =>
            onPeriodChange(event.target.value as PeriodPreset)
          }
        >
          <option value="3">최근 3일</option>
          <option value="7">최근 7일</option>
          <option value="14">최근 14일</option>
          <option value="21">최근 21일</option>
          <option value="28">최근 28일</option>
          <option value="all">전체</option>
          <option value="custom">직접 선택</option>
        </Select>
      </Field>
      {period === "custom" ? (
        <>
          <Field>
            시작일
            <Input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
          </Field>
          <Field>
            종료일
            <Input
              type="date"
              value={endDate}
              onChange={(event) => {
                const nextEndDate = event.target.value
                onEndDateChange(nextEndDate)
                if (startDate && nextEndDate && nextEndDate < startDate) {
                  onStartDateChange(nextEndDate)
                }
              }}
            />
          </Field>
        </>
      ) : null}
      <Field>
        유형
        <Select
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          <option value="">전체</option>
          <option value="expense">지출</option>
          <option value="income">수입</option>
          <option value="saving">저축</option>
        </Select>
      </Field>
      <Field>
        상태
        <Select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="">전체</option>
          <option value="confirmed">확정</option>
          <option value="excluded">제외</option>
        </Select>
      </Field>
      <Field>
        카테고리
        <Select
          value={categoryId}
          onChange={(event) => onCategoryIdChange(event.target.value)}
        >
          <option value="">전체</option>
          {store.currentCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {getCategoryLabel(store.currentCategories, category.id)}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        행위자
        <Select
          value={actorUserId}
          onChange={(event) => onActorUserIdChange(event.target.value)}
        >
          <option value="">전체</option>
          <option value="common">공통</option>
          {store.currentMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.nickname}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        결제수단
        <PaymentFilter>
          <summary>
            {paymentMethodIds.length === 0
              ? "전체"
              : `${paymentMethodIds.length}개 선택`}
          </summary>
          <PaymentOptions>
            <label>
              <input
                type="checkbox"
                checked={paymentMethodIds.includes("cash")}
                onChange={() => onTogglePaymentMethod("cash")}
              />
              현금
            </label>
            {paymentMethods.map((method) => (
              <label key={method.id}>
                <input
                  type="checkbox"
                  checked={paymentMethodIds.includes(method.id)}
                  onChange={() => onTogglePaymentMethod(method.id)}
                />
                <span>
                  {method.issuer ? `${method.issuer} · ` : ""}
                  {method.name}
                  {method.isDeleted ? " · 삭제" : ""}
                </span>
              </label>
            ))}
          </PaymentOptions>
        </PaymentFilter>
      </Field>
      <Field>
        가맹점·메모
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="검색어"
        />
      </Field>
    </Filters>
  )
})

const Filters = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`
const PaymentFilter = styled.details`
  position: relative;

  summary {
    min-height: 38px;
    display: flex;
    align-items: center;
    border: 1px solid ${colors.border};
    border-radius: ${radii.md};
    background: ${colors.panel};
    color: ${colors.ink};
    padding: 0 12px;
    font-size: 13px;
    cursor: pointer;
    list-style-position: inside;
  }
`
const PaymentOptions = styled.div`
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  display: grid;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  padding: 6px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    border-radius: ${radii.sm};
    padding: 7px 8px;
    color: ${colors.ink};
    font-size: 12px;
    cursor: pointer;
  }

  label:hover {
    background: ${colors.panelSubtle};
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`
