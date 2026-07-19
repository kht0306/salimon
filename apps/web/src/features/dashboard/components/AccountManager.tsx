"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { Check, Landmark, Plus, Power, PowerOff, Trash2 } from "lucide-react"
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

const banks = [
  "KB국민은행",
  "신한은행",
  "하나은행",
  "우리은행",
  "NH농협은행",
  "IBK기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "SC제일은행",
  "한국씨티은행",
  "부산은행",
  "대구은행",
  "광주은행",
  "전북은행",
  "경남은행",
  "새마을금고",
  "신협",
  "우체국",
  "기타",
]

export const AccountManager = observer(function AccountManager() {
  const store = useAppStore()
  const ownerUserId = store.authUser?.id ?? ""
  const [bank, setBank] = useState(banks[0])
  const [name, setName] = useState("")
  const [last4, setLast4] = useState("")
  const [visibility, setVisibility] = useState<"ledger" | "private">("private")
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  )
  const canSave =
    Boolean(ownerUserId && bank.trim() && name.trim()) &&
    (!last4 || last4.length === 4)
  const effectiveVisibility =
    store.currentLedger?.type === "personal"
      ? "private"
      : visibility

  function resetForm() {
    setSelectedAccountId(null)
    setBank(banks[0])
    setName("")
    setLast4("")
    setVisibility("private")
  }

  function selectAccount(
    account: (typeof store.currentLedgerAccounts)[number],
  ) {
    if (account.ownerUserId !== store.authUser?.id) return
    if (selectedAccountId === account.id) {
      resetForm()
      return
    }
    setSelectedAccountId(account.id)
    setBank(account.issuer ?? banks[0])
    setName(account.name)
    setLast4(account.last4 ?? "")
    setVisibility(account.visibility)
  }

  async function save() {
    const input = {
      ownerUserId,
      bank,
      name,
      last4: last4 || undefined,
      visibility: effectiveVisibility,
    }
    const saved = selectedAccountId
      ? await store.updateAccount(selectedAccountId, input)
      : await store.createAccount(input)
    if (saved) resetForm()
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>계좌 관리</PanelTitle>
        <Button
          $variant="primary"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {selectedAccountId ? <Check size={16} /> : <Plus size={16} />}
          {selectedAccountId ? "계좌 수정" : "계좌 등록"}
        </Button>
      </PanelHeader>

      <Composer>
        <Field>
          <span>
            계좌 소유자<RequiredMark>*</RequiredMark>
          </span>
          <Input
            value={
              store.currentMembers.find(
                (member) => member.userId === store.authUser?.id,
              )?.nickname ?? "본인"
            }
            disabled
          />
          <OwnerHelp>본인 소유 계좌만 등록·수정할 수 있습니다.</OwnerHelp>
        </Field>
        <VisibilityField>
          <input
            type="checkbox"
            checked={effectiveVisibility === "ledger"}
            disabled={store.currentLedger?.type !== "shared"}
            onChange={(event) =>
              setVisibility(event.target.checked ? "ledger" : "private")
            }
          />
          공동 멤버에게 공개
          <small>
            {store.currentLedger?.type === "personal"
              ? "개인 가계부에서는 나만 볼 수 있습니다."
              : "선택하지 않으면 나만 볼 수 있습니다."}
          </small>
        </VisibilityField>
        <Field>
          <span>
            은행<RequiredMark>*</RequiredMark>
          </span>
          <Select
            value={bank}
            onChange={(event) => setBank(event.target.value)}
          >
            {banks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <span>
            계좌 별칭<RequiredMark>*</RequiredMark>
          </span>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="급여 계좌"
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
      </Composer>

      <Hint>
        전체 계좌번호와 잔액은 저장하지 않습니다. 등록한 계좌는 지출 거래의
        결제수단으로 사용할 수 있습니다.
      </Hint>

      <MemberGroups>
        {store.currentMembers.map((member) => {
          const accounts = store.currentLedgerAccounts
            .filter((account) => account.ownerUserId === member.userId)
            .sort((a, b) => a.name.localeCompare(b.name, "ko"))
          return (
            <MemberSection key={member.userId}>
              <MemberHeader>
                <MemberAvatar>{member.nickname.slice(0, 1)}</MemberAvatar>
                <div>
                  <strong>{member.nickname}</strong>
                  <span>
                    {member.role === "owner" ? "가계부 소유자" : "멤버"} · 계좌{" "}
                    {accounts.length}개
                  </span>
                </div>
              </MemberHeader>
              <Rows>
                {accounts.map((account) => (
                  <Row
                    key={account.id}
                    role={account.ownerUserId === store.authUser?.id ? "button" : undefined}
                    tabIndex={account.ownerUserId === store.authUser?.id ? 0 : undefined}
                    aria-pressed={account.ownerUserId === store.authUser?.id ? selectedAccountId === account.id : undefined}
                    $selected={selectedAccountId === account.id}
                    $interactive={account.ownerUserId === store.authUser?.id}
                    onClick={() => selectAccount(account)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        selectAccount(account)
                      }
                    }}
                  >
                    <Landmark size={18} />
                    <div>
                      <strong>{account.name}</strong>
                      <Meta>
                        {account.issuer}
                        {account.last4 ? ` · •••• ${account.last4}` : ""}
                        {!account.isActive ? " · 비활성" : ""}
                        {account.visibility === "private" ? " · 나만 보기" : ""}
                      </Meta>
                    </div>
                    {account.ownerUserId === store.authUser?.id ? (
                    <Actions onClick={(event) => event.stopPropagation()}>
                      <Button
                        $variant={account.isActive ? "ghost" : "soft"}
                        onClick={() =>
                          void store.setAccountActive(
                            account.id,
                            !account.isActive,
                          )
                        }
                      >
                        {account.isActive ? (
                          <PowerOff size={14} />
                        ) : (
                          <Power size={14} />
                        )}
                        {account.isActive ? "비활성화" : "활성화"}
                      </Button>
                      <Button
                        $variant="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              "이 계좌를 삭제하시겠습니까? 기존 거래에는 삭제된 계좌로 표시됩니다.",
                            )
                          )
                            void store.deleteAccount(account.id)
                        }}
                      >
                        <Trash2 size={14} /> 삭제
                      </Button>
                    </Actions>
                    ) : <ReadOnlyBadge>공동 공개 · 읽기 전용</ReadOnlyBadge>}
                  </Row>
                ))}
                {accounts.length === 0 ? (
                  <Empty>등록된 계좌가 없습니다.</Empty>
                ) : null}
              </Rows>
            </MemberSection>
          )
        })}
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
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
`

const VisibilityField = styled.label`
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
`

const Row = styled.article<{ $selected: boolean; $interactive: boolean }>`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  border-top: 1px solid ${colors.border};
  background: ${({ $selected }) => ($selected ? colors.tealSoft : colors.panel)};
  cursor: ${({ $interactive }) => ($interactive ? "pointer" : "default")};

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: -2px;
  }

  @media (max-width: 760px) {
    grid-template-columns: 24px minmax(0, 1fr);
  }
`

const Meta = styled.span`
  display: block;
  margin-top: 3px;
  color: ${colors.muted};
  font-size: 11px;
`
const OwnerHelp = styled.small`
  color: ${colors.muted};
  font-weight: 400;
`
const ReadOnlyBadge = styled.span`
  color: ${colors.muted};
  font-size: 11px;
  white-space: nowrap;
`

const Actions = styled.div`
  display: flex;
  gap: 6px;

  @media (max-width: 760px) {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
`

const Empty = styled.div`
  padding: 18px;
  color: ${colors.muted};
  text-align: center;
  font-size: 12px;
`
