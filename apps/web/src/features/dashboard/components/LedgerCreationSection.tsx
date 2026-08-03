"use client"

import styled from "@emotion/styled"
import type { LedgerType } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Link, Plus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { dashboardRoutes } from "../routes"
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
import { PaymentInstrumentSelector } from "./PaymentInstrumentSelector"

interface LedgerCreationSectionProps {
  onJoined: () => void
}

export const LedgerCreationSection = observer(function LedgerCreationSection({
  onJoined,
}: LedgerCreationSectionProps) {
  const store = useAppStore()
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<LedgerType>("personal")
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [newLedgerPaymentMethodIds, setNewLedgerPaymentMethodIds] = useState<
    string[]
  >([])
  const [newLedgerVisibleMethodIds, setNewLedgerVisibleMethodIds] = useState<
    string[]
  >([])
  const [inviteCode, setInviteCode] = useState("")
  const isMutating = store.ledgerMutationState !== "idle"
  const activePaymentInstruments = store.myPaymentInstruments.filter(
    (method) => method.isActive,
  )

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>새 가계부 만들기</PanelTitle>
      </PanelHeader>
      <CreateGrid>
        <Field>
          <span>
            이름<RequiredMark>*</RequiredMark>
          </span>
          <Input
            required
            value={newName}
            maxLength={30}
            disabled={isMutating}
            placeholder="예: 여행 경비"
            onChange={(event) => setNewName(event.target.value)}
          />
        </Field>
        <Field>
          <span>유형</span>
          <Select
            value={newType}
            disabled={isMutating}
            onChange={(event) => setNewType(event.target.value as LedgerType)}
          >
            <option value="personal">개인 가계부</option>
            <option value="shared">공동 가계부</option>
          </Select>
        </Field>
        <CheckboxField>
          <input
            type="checkbox"
            checked={setAsDefault}
            disabled={isMutating}
            onChange={(event) => setSetAsDefault(event.target.checked)}
          />
          로그인할 때 기본 가계부로 사용
        </CheckboxField>
        {activePaymentInstruments.length > 0 ? (
          <NewLedgerPaymentMethods>
            <strong>연결할 내 카드·계좌</strong>
            <span>
              선택하지 않아도 가계부를 만들 수 있습니다. 공동 공개는 별도로
              선택합니다.
            </span>
            <PaymentInstrumentSelector
              instruments={activePaymentInstruments}
              selectedIds={newLedgerPaymentMethodIds}
              visibleIds={newLedgerVisibleMethodIds}
              allowVisibility={newType === "shared"}
              disabled={isMutating}
              onSelectedIdsChange={setNewLedgerPaymentMethodIds}
              onVisibleIdsChange={setNewLedgerVisibleMethodIds}
            />
          </NewLedgerPaymentMethods>
        ) : null}
        <CreateButton
          type="button"
          $variant="soft"
          disabled={!newName.trim() || isMutating || !store.authUser}
          onClick={async () => {
            const created = await store.createLedger({
              name: newName,
              type: newType,
              setDefault: setAsDefault,
              paymentInstrumentIds: newLedgerPaymentMethodIds,
              ledgerVisibleInstrumentIds:
                newType === "shared" ? newLedgerVisibleMethodIds : [],
            })
            if (created) router.replace(dashboardRoutes.calendar)
          }}
        >
          <Plus size={16} />
          {store.ledgerMutationState === "creating" ? "생성 중" : "생성"}
        </CreateButton>
      </CreateGrid>

      <JoinRow>
        <Field>
          <span>
            받은 초대 코드<RequiredMark>*</RequiredMark>
          </span>
          <Input
            required
            value={inviteCode}
            maxLength={8}
            autoCapitalize="characters"
            placeholder="8자리 코드 입력"
            onChange={(event) =>
              setInviteCode(
                event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              )
            }
          />
        </Field>
        <FormAction
          type="button"
          $variant="primary"
          disabled={inviteCode.length !== 8 || !store.authUser}
          onClick={async () => {
            const result = await store.acceptInvite(inviteCode)
            if (result?.status === "accepted") {
              setInviteCode("")
              onJoined()
            } else if (result?.status === "already_member") {
              setInviteCode("")
            }
          }}
        >
          <Link size={16} /> 참여하기
        </FormAction>
      </JoinRow>
    </Panel>
  )
})

const FormRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 16px 18px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const FormAction = styled(Button)`
  align-self: start;
  margin-top: 26px;

  @media (max-width: 640px) {
    width: 100%;
    justify-content: center;
    margin-top: 0;
  }
`
const CreateGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.45fr) auto;
  gap: 12px;
  align-items: end;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`

const CreateButton = styled(Button)`
  grid-column: 1 / -1;
  width: 100%;
  justify-content: center;
`

const JoinRow = styled(FormRow)`
  background: ${colors.panelSubtle};
`

const NewLedgerPaymentMethods = styled.div`
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};

  > span {
    color: ${colors.muted};
    font-size: 11px;
  }
`
const CheckboxField = styled.label`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${colors.ink};
  font-size: 12px;
  white-space: nowrap;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${colors.teal};
  }
`
