"use client"

import styled from "@emotion/styled"
import type { PaymentInstrument } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import {
  Check,
  Landmark,
  Pencil,
  Plus,
  Power,
  PowerOff,
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
  const [bank, setBank] = useState(banks[0])
  const [name, setName] = useState("")
  const [last4, setLast4] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  )
  const accounts = store.myPaymentInstruments
    .filter((method) => method.type === "bank")
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name, "ko"),
    )
  const canSave =
    Boolean(store.authUser && bank.trim() && name.trim()) &&
    (!last4 || last4.length === 4)

  function resetForm() {
    setSelectedAccountId(null)
    setBank(banks[0])
    setName("")
    setLast4("")
  }

  function selectAccount(account: PaymentInstrument) {
    if (selectedAccountId === account.id) {
      resetForm()
      return
    }
    setSelectedAccountId(account.id)
    setBank(account.issuer ?? banks[0])
    setName(account.name)
    setLast4(account.last4 ?? "")
  }

  async function save() {
    const input = { bank, name, last4: last4 || undefined }
    const saved = selectedAccountId
      ? await store.updateAccount(selectedAccountId, input)
      : await store.createAccount(input)
    if (saved) resetForm()
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>내 계좌 관리</PanelTitle>
        <Button
          $variant="primary"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {selectedAccountId ? <Check size={16} /> : <Plus size={16} />}
          {selectedAccountId ? "계좌 수정" : "계좌 등록"}
        </Button>
      </PanelHeader>
      <ScopeNotice>
        계좌는 특정 가계부에 속하지 않습니다. 여기서 한 번 등록한 뒤 가계부
        관리에서 사용할 가계부에 연결하세요.
      </ScopeNotice>
      <Composer>
        <Field>
          <span>
            계좌 소유자<RequiredMark>*</RequiredMark>
          </span>
          <Input value={store.data.profile?.nickname ?? "본인"} disabled />
          <OwnerHelp>내 계정에 독립적으로 저장됩니다.</OwnerHelp>
        </Field>
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
        전체 계좌번호와 잔액은 저장하지 않습니다. 활성 계좌만 가계부 관리에서
        연결할 수 있습니다.
      </Hint>
      <ListHeader>
        <strong>내 계좌</strong>
        <span>{accounts.length}개</span>
      </ListHeader>
      <Rows>
        {accounts.map((account) => (
          <Row
            key={account.id}
            $selected={selectedAccountId === account.id}
          >
            <Landmark size={18} />
            <div>
              <strong>{account.name}</strong>
              <Meta>
                {account.issuer}
                {account.last4 ? ` · •••• ${account.last4}` : ""}
                {!account.isActive ? " · 비활성" : ""}
              </Meta>
            </div>
            <Actions>
              <Button
                $variant={selectedAccountId === account.id ? "soft" : "ghost"}
                onClick={() => selectAccount(account)}
              >
                <Pencil size={14} />
                {selectedAccountId === account.id ? "수정 취소" : "수정"}
              </Button>
              <Button
                $variant={account.isActive ? "ghost" : "soft"}
                onClick={() =>
                  void store.setAccountActive(account.id, !account.isActive)
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
                      "이 계좌를 삭제하시겠습니까? 모든 가계부 연결이 해제되며 기존 거래에는 삭제된 계좌로 표시됩니다.",
                    )
                  ) {
                    void store.deleteAccount(account.id)
                  }
                }}
              >
                <Trash2 size={14} /> 삭제
              </Button>
            </Actions>
          </Row>
        ))}
        {accounts.length === 0 ? <Empty>등록된 계좌가 없습니다.</Empty> : null}
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
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
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
  padding-bottom: 8px;
`
const Row = styled.article<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  border-top: 1px solid ${colors.border};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
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
const Empty = styled.div`
  padding: 20px 18px;
  color: ${colors.muted};
  font-size: 13px;
`
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;

  @media (max-width: 760px) {
    grid-column: 1 / -1;
  }
`
