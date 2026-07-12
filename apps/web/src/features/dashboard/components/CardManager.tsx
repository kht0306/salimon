"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { CreditCard, Power, PowerOff, Plus, Star, Trash2 } from "lucide-react"
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
  "BC카드",
  "기타",
]

export const CardManager = observer(function CardManager() {
  const store = useAppStore()
  const [issuer, setIssuer] = useState(issuers[0])
  const [name, setName] = useState("")
  const [last4, setLast4] = useState("")
  const [ownerUserId, setOwnerUserId] = useState(store.authUser?.id ?? "")
  const [paymentDay, setPaymentDay] = useState("14")
  const [endDay, setEndDay] = useState("31")
  const [endOffset, setEndOffset] = useState<"-1" | "0">("-1")
  const [isPrimary, setPrimary] = useState(false)
  const isFirstCard = !store.currentLedgerCards.some(
    (card) => card.ownerUserId === ownerUserId,
  )
  const paymentDayNumber = Number(paymentDay)
  const endDayNumber = Number(endDay)
  const canCreate =
    Boolean(ownerUserId && issuer.trim() && name.trim()) &&
    (!last4 || last4.length === 4) &&
    Number.isSafeInteger(paymentDayNumber) &&
    paymentDayNumber >= 1 &&
    paymentDayNumber <= 31 &&
    Number.isSafeInteger(endDayNumber) &&
    endDayNumber >= 1 &&
    endDayNumber <= 31

  async function create() {
    if (
      await store.createCard({
        ownerUserId,
        name,
        issuer,
        last4: last4 || undefined,
        paymentDay: Number(paymentDay),
        billingPeriodEndDay: Number(endDay),
        billingPeriodEndMonthOffset: Number(endOffset) as -1 | 0,
        isPrimary: isFirstCard || isPrimary,
      })
    ) {
      setName("")
      setLast4("")
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>카드 관리</PanelTitle>
        <Button
          $variant="primary"
          disabled={!canCreate}
          onClick={() => void create()}
        >
          <Plus size={16} /> 카드 등록
        </Button>
      </PanelHeader>
      <Composer>
        <Field>
          카드 소유자
          <Select
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
          >
            {store.currentMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.nickname}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          카드사
          <Select
            value={issuer}
            onChange={(event) => setIssuer(event.target.value)}
          >
            {issuers.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field>
          카드 별칭
          <Input
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
        <Field>
          매월 결제일
          <Input
            type="number"
            min="1"
            max="31"
            value={paymentDay}
            onChange={(event) => setPaymentDay(event.target.value)}
          />
        </Field>
        <Field>
          이용기간 종료월
          <Select
            value={endOffset}
            onChange={(event) => setEndOffset(event.target.value as "-1" | "0")}
          >
            <option value="-1">결제일의 전월</option>
            <option value="0">결제일의 당월</option>
          </Select>
        </Field>
        <Field>
          이용기간 종료일
          <Input
            type="number"
            min="1"
            max="31"
            value={endDay}
            onChange={(event) => setEndDay(event.target.value)}
          />
        </Field>
        <PrimaryField>
          <input
            type="checkbox"
            checked={isFirstCard || isPrimary}
            disabled={isFirstCard}
            onChange={(event) => setPrimary(event.target.checked)}
          />
          주 카드
          {isFirstCard ? <small>최초 카드는 자동 지정됩니다.</small> : null}
        </PrimaryField>
      </Composer>
      <Hint>
        카드사 앱의 결제일별 이용기간에서 종료일을 입력하세요. 예: 매월 14일
        결제·전월 말일까지 이용한 금액이면 ‘전월 / 31일’입니다.
      </Hint>
      <MemberGroups>
        {store.currentMembers.map((member) => {
          const memberCards = store.currentLedgerCards
            .filter((card) => card.ownerUserId === member.userId)
            .sort(
              (a, b) =>
                Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) ||
                a.name.localeCompare(b.name, "ko"),
            )
          return (
            <MemberSection key={member.userId}>
              <MemberHeader>
                <MemberAvatar>{member.nickname.slice(0, 1)}</MemberAvatar>
                <div>
                  <strong>{member.nickname}</strong>
                  <span>
                    {member.role === "owner" ? "가계부 소유자" : "멤버"} · 카드{" "}
                    {memberCards.length}개
                  </span>
                </div>
              </MemberHeader>
              <Rows>
                {memberCards.map((card) => (
                  <Row key={card.id}>
                    <CreditCard size={18} />
                    <div>
                      <strong>{card.name}</strong>
                      <Meta>
                        {card.issuer}
                        {card.last4 ? ` · •••• ${card.last4}` : ""} · 매월{" "}
                        {card.paymentDay}일{!card.isActive ? " · 비활성" : ""}
                        {card.isPrimary ? " · 주 카드" : ""}
                      </Meta>
                    </div>
                    <Actions>
                      {card.isPrimary ? (
                        <PrimaryBadge>
                          <Star size={13} fill="currentColor" /> 주 카드
                        </PrimaryBadge>
                      ) : (
                        <Button
                          $variant="soft"
                          onClick={() => void store.setCardPrimary(card.id)}
                        >
                          <Star size={13} /> 주 카드 설정
                        </Button>
                      )}
                      <Button
                        $variant={card.isActive ? "ghost" : "soft"}
                        onClick={() =>
                          void store.setCardActive(card.id, !card.isActive)
                        }
                      >
                        {card.isActive ? (
                          <PowerOff size={14} />
                        ) : (
                          <Power size={14} />
                        )}
                        {card.isActive ? "비활성화" : "활성화"}
                      </Button>
                      <Button
                        $variant="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              "이 카드를 삭제하시겠습니까? 기존 거래에는 삭제된 카드로 표시됩니다.",
                            )
                          )
                            void store.deleteCard(card.id)
                        }}
                      >
                        <Trash2 size={14} /> 삭제
                      </Button>
                    </Actions>
                  </Row>
                ))}
                {memberCards.length === 0 ? (
                  <Empty>등록된 카드가 없습니다.</Empty>
                ) : null}
              </Rows>
            </MemberSection>
          )
        })}
        {store.currentMembers.length === 0 ? (
          <Empty>가계부 멤버가 없습니다.</Empty>
        ) : null}
      </MemberGroups>
    </Panel>
  )
})

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
const PrimaryField = styled.label`
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
const MemberGroups = styled.div`
  display: grid;
`
const MemberSection = styled.section`
  & + & {
    border-top: 1px solid ${colors.border};
  }
`
const MemberHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 8px;

  span {
    display: block;
    margin-top: 2px;
    color: ${colors.muted};
    font-size: 11px;
  }
`
const MemberAvatar = styled.div`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${colors.tealSoft};
  color: ${colors.teal};
  font-weight: 700;
`
const Rows = styled.div`
  display: grid;
  padding: 4px 18px 12px;
`
const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid ${colors.border};
`
const Meta = styled.div`
  margin-top: 3px;
  color: ${colors.muted};
  font-size: 12px;
`
const Empty = styled.div`
  padding: 20px 0;
  color: ${colors.muted};
  font-size: 13px;
`
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`
const PrimaryBadge = styled.span`
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #c4b5fd;
  border-radius: 6px;
  background: #f5f3ff;
  color: ${colors.violet};
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
`
