"use client"

import styled from "@emotion/styled"
import type { CreatedLedgerInvitation } from "@salimon/api-client"
import type { LedgerType } from "@salimon/types"
import { colors, radii, spacing } from "@salimon/ui-tokens"
import { Copy, Link, Pencil, Plus, Share2 } from "lucide-react"
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

const roleLabels = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  viewer: "뷰어",
} as const

const invitationLabels = {
  active: "사용 가능",
  accepted: "수락됨",
  expired: "만료됨",
  revoked: "취소됨",
} as const

export const LedgerManagementPanel = observer(function LedgerManagementPanel() {
  const store = useAppStore()
  const ledger = store.currentLedger
  const [renameName, setRenameName] = useState(ledger?.name ?? "")
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<LedgerType>("personal")
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedLedgerInvitation | null>(null)
  const [sharedPaymentMethodIds, setSharedPaymentMethodIds] = useState<
    string[]
  >([])
  const invitations = store.data.invitations.filter(
    (invite) => invite.ledgerId === store.selectedLedgerId,
  )
  const canRename = Boolean(
    ledger &&
    (ledger.type === "personal"
      ? ledger.ownerId === store.authUser?.id
      : ledger.role === "owner" || ledger.role === "admin"),
  )
  const canManageShared = ledger?.role === "owner" || ledger?.role === "admin"
  const isMutating = store.ledgerMutationState !== "idle"

  return (
    <PanelStack>
      <Panel>
        <PanelHeader>
          <PanelTitle>현재 가계부</PanelTitle>
          {ledger ? (
            <LedgerMeta>
              {ledger.type === "shared" ? "공동" : "개인"} ·{" "}
              {roleLabels[ledger.role]}
            </LedgerMeta>
          ) : null}
        </PanelHeader>

        <FormRow>
          <Field>
            <span>
              가계부 이름<RequiredMark>*</RequiredMark>
            </span>
            <Input
              value={renameName}
              maxLength={30}
              disabled={!canRename || isMutating}
              onChange={(event) => setRenameName(event.target.value)}
              aria-describedby={
                ledger?.type === "shared" ? "shared-rename-help" : undefined
              }
            />
            {ledger?.type === "shared" ? (
              <FieldHelp id="shared-rename-help">
                변경한 이름은 모든 공동 멤버에게 동일하게 표시됩니다.
              </FieldHelp>
            ) : null}
          </Field>
          <Button
            type="button"
            $variant="primary"
            disabled={
              !canRename ||
              isMutating ||
              !renameName.trim() ||
              renameName.trim() === ledger?.name
            }
            onClick={() => void store.renameCurrentLedger(renameName)}
          >
            <Pencil size={15} />
            {store.ledgerMutationState === "renaming" ? "변경 중" : "변경"}
          </Button>
        </FormRow>

        {!canRename && ledger ? (
          <PermissionNotice>
            이 가계부의 이름을 변경할 권한이 없습니다.
          </PermissionNotice>
        ) : null}
      </Panel>

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
          <Button
            type="button"
            $variant="soft"
            disabled={!newName.trim() || isMutating || !store.authUser}
            onClick={async () => {
              await store.createLedger({
                name: newName,
                type: newType,
                setDefault: setAsDefault,
              })
            }}
          >
            <Plus size={16} />
            {store.ledgerMutationState === "creating" ? "생성 중" : "생성"}
          </Button>
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
          <Button
            type="button"
            $variant="primary"
            disabled={inviteCode.length !== 8 || !store.authUser}
            onClick={async () => {
              if (await store.acceptInvite(inviteCode)) setInviteCode("")
            }}
          >
            <Link size={16} /> 참여하기
          </Button>
        </JoinRow>
      </Panel>

      {ledger?.type === "personal" ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>공동 사용</PanelTitle>
          </PanelHeader>
          <ConversionNotice>
            <div>
              <strong>현재 개인 가계부를 함께 사용하기</strong>
              <p>
                거래와 카테고리는 그대로 유지됩니다. 아래에서 선택한 카드와
                계좌만 공동 멤버에게 공개되며, 선택하지 않은 결제수단은 나만 볼
                수 있습니다.
              </p>
              <PaymentMethodChoices>
                {[
                  ...store.currentLedgerCards,
                  ...store.currentLedgerAccounts,
                ].map((method) => (
                  <label key={method.id}>
                    <input
                      type="checkbox"
                      checked={sharedPaymentMethodIds.includes(method.id)}
                      onChange={(event) =>
                        setSharedPaymentMethodIds((current) =>
                          event.target.checked
                            ? [...current, method.id]
                            : current.filter((id) => id !== method.id),
                        )
                      }
                    />
                    {method.type === "card" ? "카드" : "계좌"} · {method.name}
                    {method.last4 ? ` (•••• ${method.last4})` : ""}
                  </label>
                ))}
                {store.currentLedgerCards.length === 0 &&
                store.currentLedgerAccounts.length === 0 ? (
                  <span>등록된 카드와 계좌가 없습니다.</span>
                ) : null}
              </PaymentMethodChoices>
            </div>
            <Button
              type="button"
              $variant="primary"
              disabled={ledger.ownerId !== store.authUser?.id}
              onClick={() => {
                if (
                  window.confirm(
                    "현재 개인 가계부를 공동 가계부로 전환하시겠습니까? 기존 데이터는 모두 유지되며 개인 가계부로 되돌릴 수 없습니다.",
                  )
                ) {
                  void store.convertCurrentLedgerToShared(
                    sharedPaymentMethodIds,
                  )
                }
              }}
            >
              <Share2 size={15} /> 공동 가계부로 전환
            </Button>
          </ConversionNotice>
        </Panel>
      ) : null}

      {ledger?.type === "shared" ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>공동 멤버와 초대</PanelTitle>
            <Button
              type="button"
              $variant="primary"
              onClick={async () => {
                const invitation = await store.createInvite()
                if (invitation) setCreatedInvitation(invitation)
              }}
              disabled={!store.authUser || !canManageShared}
              title={
                canManageShared
                  ? "초대 코드 생성"
                  : "소유자와 관리자만 초대할 수 있습니다."
              }
            >
              <Link size={16} /> 초대 생성
            </Button>
          </PanelHeader>

          {createdInvitation ? (
            <OneTimeInvite>
              <div>
                <strong>새 초대 코드: {createdInvitation.inviteCode}</strong>
                <p>
                  이 코드는 지금 한 번만 표시됩니다. 참여할 사람에게 안전하게
                  전달해 주세요.
                </p>
              </div>
              <Button
                type="button"
                $variant="soft"
                onClick={() =>
                  navigator.clipboard?.writeText(createdInvitation.inviteCode)
                }
              >
                <Copy size={15} /> 복사
              </Button>
            </OneTimeInvite>
          ) : null}

          <Section>
            <SectionTitle>멤버</SectionTitle>
            <Rows>
              {store.currentMembers.map((member) => (
                <Row key={member.id}>
                  <Avatar>{member.nickname.slice(0, 1)}</Avatar>
                  <div>
                    <strong>{member.nickname}</strong>
                    <Meta>{roleLabels[member.role]}</Meta>
                  </div>
                </Row>
              ))}
            </Rows>
          </Section>

          <Section>
            <SectionTitle>초대</SectionTitle>
            <Rows>
              {invitations.map((invitation) => (
                <InviteRow key={invitation.id}>
                  <Code>{invitation.inviteCode ?? "보안 저장됨"}</Code>
                  <div>
                    <strong>{invitationLabels[invitation.status]}</strong>
                    <Meta>
                      {new Date(invitation.expiresAt).toLocaleDateString(
                        "ko-KR",
                      )}{" "}
                      만료
                    </Meta>
                  </div>
                  {invitation.inviteCode ? (
                    <Button
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(invitation.inviteCode!)
                      }
                    >
                      <Copy size={15} /> 복사
                    </Button>
                  ) : null}
                </InviteRow>
              ))}
              {invitations.length === 0 ? <Empty>초대 없음</Empty> : null}
            </Rows>
          </Section>
        </Panel>
      ) : null}
    </PanelStack>
  )
})

const PanelStack = styled.div`
  display: grid;
  gap: ${spacing[4]};
`

const LedgerMeta = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`

const FormRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding: 16px 18px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const CreateGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.45fr) auto auto;
  gap: 12px;
  align-items: end;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`

const JoinRow = styled(FormRow)`
  background: ${colors.panelSubtle};
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

const FieldHelp = styled.span`
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 400;
`

const PermissionNotice = styled.p`
  margin: 0;
  padding: 0 18px 16px;
  color: ${colors.muted};
  font-size: 12px;
`

const ConversionNotice = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  background: ${colors.tealSoft};

  p {
    margin: 4px 0 0;
    color: ${colors.muted};
    font-size: 12px;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const PaymentMethodChoices = styled.div`
  display: grid;
  gap: 7px;
  margin-top: 12px;

  label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
  }

  span {
    color: ${colors.muted};
    font-size: 12px;
  }
`

const OneTimeInvite = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 18px 0;
  padding: 14px;
  border: 1px solid ${colors.teal};
  border-radius: ${radii.md};
  background: ${colors.tealSoft};

  p {
    margin: 4px 0 0;
    color: ${colors.muted};
    font-size: 12px;
  }
`

const Section = styled.section`
  padding: 16px 18px 4px;

  & + & {
    border-top: 1px solid ${colors.border};
  }
`

const SectionTitle = styled.h3`
  margin: 0 0 10px;
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 600;
`

const Rows = styled.div`
  display: grid;
`

const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;
`

const InviteRow = styled(Row)`
  grid-template-columns: auto minmax(0, 1fr) auto;
`

const Avatar = styled.div`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: ${radii.round};
  background: ${colors.tealSoft};
  color: ${colors.teal};
  font-weight: 700;
`

const Meta = styled.div`
  margin-top: 2px;
  color: ${colors.muted};
  font-size: 12px;
`

const Code = styled.div`
  min-width: 76px;
  color: ${colors.blue};
  font-family: var(--font-geist-mono);
  font-weight: 650;
`

const Empty = styled.div`
  min-height: 56px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${colors.border};
  color: ${colors.muted};
  font-size: 12px;
`
