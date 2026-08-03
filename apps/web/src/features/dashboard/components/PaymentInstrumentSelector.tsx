"use client"

import styled from "@emotion/styled"
import type { PaymentInstrument } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Check, CreditCard, Landmark, Lock, Users } from "lucide-react"
import { useId } from "react"

interface PaymentInstrumentSelectorProps {
  instruments: PaymentInstrument[]
  selectedIds: string[]
  visibleIds: string[]
  allowVisibility: boolean
  disabled: boolean
  onSelectedIdsChange: (ids: string[]) => void
  onVisibleIdsChange: (ids: string[]) => void
}

function getPaymentMethodTypeLabel(
  method: Pick<PaymentInstrument, "type" | "isDebit">,
) {
  if (method.type === "card") {
    return method.isDebit ? "체크카드" : "신용카드"
  }
  if (method.type === "bank") return "계좌"
  return "결제수단"
}

function getPaymentMethodGroups<T extends Pick<PaymentInstrument, "type">>(
  methods: T[],
) {
  return [
    {
      type: "card" as const,
      label: "카드",
      methods: methods.filter((method) => method.type === "card"),
    },
    {
      type: "bank" as const,
      label: "계좌",
      methods: methods.filter((method) => method.type === "bank"),
    },
  ].filter((group) => group.methods.length > 0)
}

export function PaymentInstrumentSelector({
  instruments,
  selectedIds,
  visibleIds,
  allowVisibility,
  disabled,
  onSelectedIdsChange,
  onVisibleIdsChange,
}: PaymentInstrumentSelectorProps) {
  const visibilityInputName = useId()
  const methodGroups = getPaymentMethodGroups(instruments)
  const allIds = instruments.map((method) => method.id)
  const selectedCount = allIds.filter((id) => selectedIds.includes(id)).length
  const allSelected =
    instruments.length > 0 && selectedCount === instruments.length
  const visibleSelectedCount = selectedIds.filter((id) =>
    visibleIds.includes(id),
  ).length
  const visibilityMode =
    selectedCount === 0 || visibleSelectedCount === 0
      ? "private"
      : visibleSelectedCount === selectedCount
        ? "ledger"
        : "mixed"

  function setConnected(methodId: string, connected: boolean) {
    const nextSelectedIds = connected
      ? [...selectedIds, methodId]
      : selectedIds.filter((id) => id !== methodId)
    onSelectedIdsChange(nextSelectedIds)
    if (!connected) {
      onVisibleIdsChange(visibleIds.filter((id) => id !== methodId))
    } else if (visibilityMode === "ledger") {
      onVisibleIdsChange([...visibleIds, methodId])
    }
  }

  return (
    <PaymentMethodOptions>
      <SelectorToolbar>
        <div>
          <strong>연결할 결제수단</strong>
          <span>
            {selectedCount > 0
              ? `${instruments.length}개 중 ${selectedCount}개 선택`
              : "연결할 카드·계좌를 선택하세요"}
          </span>
        </div>
        <SelectAllOption
          type="button"
          aria-pressed={allSelected}
          disabled={disabled}
          $selected={allSelected}
          onClick={() => {
            onSelectedIdsChange(allSelected ? [] : allIds)
            if (allSelected) {
              onVisibleIdsChange([])
            } else if (visibilityMode === "ledger") {
              onVisibleIdsChange(allIds)
            }
          }}
        >
          {allSelected ? <Check size={14} /> : null}
          {allSelected ? "전체 선택됨" : "전체 선택"}
        </SelectAllOption>
      </SelectorToolbar>
      <PaymentMethodGroups>
        {methodGroups.map((group) => (
          <PaymentMethodGroup key={group.type}>
            <PaymentMethodGroupHeader>
              <span>
                {group.type === "card" ? (
                  <CreditCard size={15} />
                ) : (
                  <Landmark size={15} />
                )}
                {group.label}
              </span>
              <small>{group.methods.length}개</small>
            </PaymentMethodGroupHeader>
            <PaymentMethodGroupItems>
              {group.methods.map((method) => {
                const isConnected = selectedIds.includes(method.id)
                return (
                  <PaymentMethodOption
                    key={method.id}
                    type="button"
                    aria-pressed={isConnected}
                    disabled={disabled}
                    $selected={isConnected}
                    onClick={() => setConnected(method.id, !isConnected)}
                  >
                    <MethodIcon aria-hidden="true">
                      {method.type === "card" ? (
                        <CreditCard size={18} />
                      ) : (
                        <Landmark size={18} />
                      )}
                    </MethodIcon>
                    <MethodDetails>
                      <strong>{method.name}</strong>
                      <span>
                        {getPaymentMethodTypeLabel(method)}
                        {method.issuer ? ` · ${method.issuer}` : ""}
                        {method.last4 ? ` · •••• ${method.last4}` : ""}
                      </span>
                    </MethodDetails>
                    <SelectionStatus>
                      {isConnected ? (
                        <>
                          <Check size={14} /> 연결됨
                        </>
                      ) : (
                        "연결"
                      )}
                    </SelectionStatus>
                  </PaymentMethodOption>
                )
              })}
            </PaymentMethodGroupItems>
          </PaymentMethodGroup>
        ))}
      </PaymentMethodGroups>
      {allowVisibility && selectedCount > 0 ? (
        <VisibilityFieldset>
          <legend>공개 범위</legend>
          <VisibilityHelp>
            {visibilityMode === "mixed"
              ? "현재 결제수단별 공개 범위가 달라요. 아래 범위를 선택하면 연결된 전체 결제수단에 적용됩니다."
              : "연결한 카드·계좌가 공동 멤버에게 보일지 선택하세요."}
          </VisibilityHelp>
          <VisibilityChoices>
            <VisibilityChoice $selected={visibilityMode === "private"}>
              <input
                type="radio"
                name={visibilityInputName}
                checked={visibilityMode === "private"}
                disabled={disabled}
                onChange={() => onVisibleIdsChange([])}
              />
              <Lock size={19} aria-hidden="true" />
              <span>
                <strong>나만 보기</strong>
                <small>연결한 자산은 내 화면에만 표시돼요.</small>
              </span>
              {visibilityMode === "private" ? (
                <Check size={16} aria-hidden="true" />
              ) : null}
            </VisibilityChoice>
            <VisibilityChoice $selected={visibilityMode === "ledger"}>
              <input
                type="radio"
                name={visibilityInputName}
                checked={visibilityMode === "ledger"}
                disabled={disabled}
                onChange={() => onVisibleIdsChange(selectedIds)}
              />
              <Users size={19} aria-hidden="true" />
              <span>
                <strong>공동 멤버와 보기</strong>
                <small>멤버에게 카드·계좌와 연결된 거래가 보여요.</small>
              </span>
              {visibilityMode === "ledger" ? (
                <Check size={16} aria-hidden="true" />
              ) : null}
            </VisibilityChoice>
          </VisibilityChoices>
          <VisibilityStatus $shared={visibilityMode === "ledger"}>
            {visibilityMode === "ledger"
              ? `선택한 ${selectedCount}개 결제수단을 공동 멤버와 공유합니다.`
              : visibilityMode === "private"
                ? `선택한 ${selectedCount}개 결제수단은 나만 볼 수 있습니다.`
                : `${visibleSelectedCount}개는 공개, ${selectedCount - visibleSelectedCount}개는 나만 보기 상태입니다.`}
          </VisibilityStatus>
        </VisibilityFieldset>
      ) : null}
    </PaymentMethodOptions>
  )
}

const PaymentMethodOptions = styled.div`
  display: grid;
  gap: 10px;
`

const PaymentMethodGroups = styled.div`
  display: grid;
  gap: 12px;
`

const PaymentMethodGroup = styled.div`
  display: grid;
  gap: 7px;
`

const PaymentMethodGroupHeader = styled.div`
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  color: ${colors.muted};
  padding: 0 2px 6px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 700;
  }

  small {
    font-size: 10px;
  }
`

const PaymentMethodGroupItems = styled.div`
  display: grid;
  gap: 8px;
`

const SelectorToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 2px;

  > div {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 12px;
  }

  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`

const SelectAllOption = styled.button<{ $selected: boolean }>`
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.borderStrong)};
  border-radius: ${radii.sm};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.ink)};
  padding: 0 10px;
  font-size: 11px;
  font-weight: 650;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const PaymentMethodOption = styled.button<{ $selected: boolean }>`
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.border)};
  border-radius: ${radii.md};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${colors.ink};
  padding: 10px 12px;
  text-align: left;

  &:hover:not(:disabled) {
    border-color: ${({ $selected }) =>
      $selected ? colors.teal : colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const MethodIcon = styled.span`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  color: ${colors.teal};
`

const MethodDetails = styled.span`
  min-width: 0;
  display: grid;
  gap: 3px;

  strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: ${colors.muted};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const SelectionStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${colors.teal};
  font-size: 11px;
  font-weight: 650;
`

const VisibilityFieldset = styled.fieldset`
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  padding: 12px;

  legend {
    padding: 0 5px;
    color: ${colors.ink};
    font-size: 12px;
    font-weight: 700;
  }
`

const VisibilityHelp = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 11px;
`

const VisibilityChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const VisibilityChoice = styled.label<{ $selected: boolean }>`
  position: relative;
  min-width: 0;
  min-height: 72px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.border)};
  border-radius: ${radii.md};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.ink)};
  padding: 11px 12px;
  cursor: pointer;

  &:has(input:focus-visible) {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  &:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }

  > input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  > span {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  strong {
    color: ${colors.ink};
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    line-height: 1.4;
  }
`

const VisibilityStatus = styled.div<{ $shared: boolean }>`
  border-left: 3px solid
    ${({ $shared }) => ($shared ? colors.teal : colors.borderStrong)};
  background: ${({ $shared }) =>
    $shared ? colors.tealSoft : colors.panelSubtle};
  color: ${({ $shared }) => ($shared ? colors.teal : colors.muted)};
  padding: 8px 10px;
  font-size: 11px;
`
