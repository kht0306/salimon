"use client"

import styled from "@emotion/styled"
import type { PaymentInstrument } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import {
  Check,
  CreditCard,
  Pencil,
  Power,
  PowerOff,
  Plus,
  Trash2,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  RequiredMark,
  Select,
} from "../styles"

const issuers = [
  "현대카드",
  "신한카드",
  "삼성카드",
  "KB국민카드",
  "롯데카드",
  "하나카드",
  "우리카드",
  "NH농협카드",
  "카카오뱅크",
  "BC카드",
  "기타",
]

export const CardManager = observer(function CardManager() {
  const store = useAppStore()
  const [issuer, setIssuer] = useState(issuers[0])
  const [name, setName] = useState("")
  const [last4, setLast4] = useState("")
  const [paymentDay, setPaymentDay] = useState("")
  const [endDay, setEndDay] = useState("")
  const [endOffset, setEndOffset] = useState<"-1" | "0">("-1")
  const [isDebit, setDebit] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const cards = store.myPaymentInstruments
    .filter((method) => method.type === "card")
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name, "ko"),
    )
  const paymentDayNumber = Number(paymentDay)
  const endDayNumber = Number(endDay)
  const canSave =
    Boolean(store.authUser && issuer.trim() && name.trim()) &&
    (!last4 || last4.length === 4) &&
    (isDebit ||
      (Number.isSafeInteger(paymentDayNumber) &&
        paymentDayNumber >= 1 &&
        paymentDayNumber <= 31 &&
        Number.isSafeInteger(endDayNumber) &&
        endDayNumber >= 1 &&
        endDayNumber <= 31))

  function resetForm() {
    setSelectedCardId(null)
    setIssuer(issuers[0])
    setName("")
    setLast4("")
    setPaymentDay("")
    setEndDay("")
    setEndOffset("-1")
    setDebit(false)
  }

  function selectCard(card: PaymentInstrument) {
    if (selectedCardId === card.id) {
      resetForm()
      return
    }
    setSelectedCardId(card.id)
    setIssuer(card.issuer ?? issuers[0])
    setName(card.name)
    setLast4(card.last4 ?? "")
    setPaymentDay(String(card.paymentDay ?? 14))
    setEndDay(String(card.billingPeriodEndDay ?? 31))
    setEndOffset(String(card.billingPeriodEndMonthOffset ?? -1) as "-1" | "0")
    setDebit(Boolean(card.isDebit))
  }

  async function save() {
    const input = {
      name,
      issuer,
      last4: last4 || undefined,
      paymentDay: isDebit ? 31 : Number(paymentDay),
      billingPeriodEndDay: isDebit ? 31 : Number(endDay),
      billingPeriodEndMonthOffset: isDebit
        ? (-1 as const)
        : (Number(endOffset) as -1 | 0),
      isDebit,
    }
    const saved = selectedCardId
      ? await store.updateCard(selectedCardId, input)
      : await store.createCard(input)
    if (saved) resetForm()
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>내 카드 관리</PanelTitle>
        <Button
          $variant="primary"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {selectedCardId ? <Check size={16} /> : <Plus size={16} />}
          {selectedCardId ? "카드 수정" : "카드 등록"}
        </Button>
      </PanelHeader>
      <ScopeNotice>
        카드는 특정 가계부에 속하지 않습니다. 여기서 한 번 등록한 뒤 가계부
        관리에서 사용할 가계부와 주 카드를 선택하세요.
      </ScopeNotice>
      <Composer>
        <Field>
          <span>
            카드 소유자<RequiredMark>*</RequiredMark>
          </span>
          <Input value={store.data.profile?.nickname ?? "본인"} disabled />
          <OwnerHelp>내 계정에 독립적으로 저장됩니다.</OwnerHelp>
        </Field>
        <Field>
          <span>
            카드사<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={issuer}
            onChange={(event) => setIssuer(event.target.value)}
          >
            {issuers.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <span>
            카드 별칭<RequiredMark>*</RequiredMark>
          </span>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="생활비 카드"
          />
        </Field>
        <Field>
          끝 4자리 (선택)
          <Input
            inputMode="numeric"
            maxLength={4}
            value={last4}
            onChange={(event) =>
              setLast4(event.target.value.replace(/\D/g, ""))
            }
          />
        </Field>
        <CheckField>
          <input
            type="checkbox"
            checked={isDebit}
            onChange={(event) => setDebit(event.target.checked)}
          />
          체크카드
          <small>결제일과 이용기간은 자동 설정됩니다.</small>
        </CheckField>
        {!isDebit ? (
          <Field>
            <span>
              매월 결제일<RequiredMark>*</RequiredMark>
            </span>
            <Input
              required
              type="number"
              min="1"
              max="31"
              value={paymentDay}
              onChange={(event) => setPaymentDay(event.target.value)}
            />
          </Field>
        ) : null}
        {!isDebit ? (
          <Field>
            <span>
              이용기간 종료월<RequiredMark>*</RequiredMark>
            </span>
            <Select
              required
              value={endOffset}
              onChange={(event) =>
                setEndOffset(event.target.value as "-1" | "0")
              }
            >
              <option value="-1">결제일의 전월</option>
              <option value="0">결제일의 당월</option>
            </Select>
          </Field>
        ) : null}
        {!isDebit ? (
          <Field>
            <span>
              이용기간 종료일<RequiredMark>*</RequiredMark>
            </span>
            <Input
              required
              type="number"
              min="1"
              max="31"
              value={endDay}
              onChange={(event) => setEndDay(event.target.value)}
            />
          </Field>
        ) : null}
      </Composer>
      <Hint>
        {isDebit
          ? "체크카드는 결제일 말일, 이용기간은 전월 말일까지로 자동 저장됩니다."
          : "카드사 앱의 결제일별 이용기간에서 종료일을 입력하세요. 예: 매월 14일 결제·전월 말일까지 이용한 금액이면 ‘전월 / 31일’입니다."}
      </Hint>
      <ListHeader>
        <strong>내 카드</strong>
        <span>{cards.length}개</span>
      </ListHeader>
      <Rows>
        {cards.map((card) => (
          <Row
            key={card.id}
            $selected={selectedCardId === card.id}
          >
            <CreditCard size={18} />
            <div>
              <strong>{card.name}</strong>
              <Meta>
                {card.issuer}
                {card.last4 ? ` · •••• ${card.last4}` : ""}
                {card.isDebit ? " · 체크카드" : ` · 매월 ${card.paymentDay}일`}
                {!card.isActive ? " · 비활성" : ""}
              </Meta>
            </div>
            <Actions>
              <Button
                $variant={selectedCardId === card.id ? "soft" : "ghost"}
                onClick={() => selectCard(card)}
              >
                <Pencil size={14} />
                {selectedCardId === card.id ? "수정 취소" : "수정"}
              </Button>
              <Button
                $variant={card.isActive ? "ghost" : "soft"}
                onClick={() =>
                  void store.setCardActive(card.id, !card.isActive)
                }
              >
                {card.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                {card.isActive ? "비활성화" : "활성화"}
              </Button>
              <Button
                $variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "이 카드를 삭제하시겠습니까? 모든 가계부 연결이 해제되며 기존 거래에는 삭제된 카드로 표시됩니다.",
                    )
                  ) {
                    void store.deleteCard(card.id)
                  }
                }}
              >
                <Trash2 size={14} /> 삭제
              </Button>
            </Actions>
          </Row>
        ))}
        {cards.length === 0 ? <Empty>등록된 카드가 없습니다.</Empty> : null}
      </Rows>
    </Panel>
  )
})

const ScopeNotice = styled.p`
  margin: 0;
  padding: 12px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.tealSoft};
  color: ${colors.ink};
  font-size: 12px;
`
const Composer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 12px;
  padding: 16px 18px;
  background: ${colors.panelSubtle};
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`
const Hint = styled.p`
  margin: 0;
  padding: 10px 18px;
  color: ${colors.muted};
  font-size: 12px;
  border-bottom: 1px solid ${colors.border};
`
const CheckField = styled.label`
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  color: ${colors.ink};
  font-size: 13px;
  font-weight: 600;

  small {
    color: ${colors.muted};
    font-size: 11px;
    font-weight: 400;
  }
`
const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 8px;

  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`
const Rows = styled.div`
  display: grid;
  padding: 4px 18px 12px;
`
const Row = styled.div<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin: 2px 0;
  padding: 12px 10px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : "transparent")};
  border-bottom-color: ${({ $selected }) =>
    $selected ? colors.teal : colors.border};
  border-radius: 8px;
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : "transparent"};
  @media (max-width: 760px) {
    grid-template-columns: 24px minmax(0, 1fr);
  }
`
const Meta = styled.div`
  margin-top: 3px;
  color: ${colors.muted};
  font-size: 12px;
`
const OwnerHelp = styled.small`
  color: ${colors.muted};
  font-weight: 400;
`
const Empty = styled.div`
  padding: 20px 0;
  color: ${colors.muted};
  font-size: 13px;
`
const Actions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;

  @media (max-width: 760px) {
    grid-column: 1 / -1;
  }
`
