"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import { Copy, Link, Plus, UserMinus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Field, Input, Panel, PanelHeader, PanelTitle } from "../styles"

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

export const SharedLedgerPanel = observer(function SharedLedgerPanel() {
  const store = useAppStore()
  const [name, setName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const invitations = store.data.invitations.filter(
    (invite) => invite.ledgerId === store.selectedLedgerId,
  )

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>공동 가계부</PanelTitle>
        <Button
          $variant="primary"
          onClick={() => void store.createInvite()}
          disabled={!store.authUser || store.currentLedger?.type !== "shared"}
          title={
            store.currentLedger?.type === "shared"
              ? "초대코드 생성"
              : "공동 가계부에서만 초대할 수 있습니다."
          }
        >
          <Link size={16} /> 초대 생성
        </Button>
      </PanelHeader>

      <Composer>
        <Field>
          새 공동 가계부
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Button
          $variant="soft"
          onClick={async () => {
            if (await store.createSharedLedger(name)) {
              setName("")
            }
          }}
          disabled={!name.trim() || !store.authUser}
        >
          <Plus size={16} /> 생성
        </Button>
      </Composer>

      <Composer>
        <Field>
          받은 초대코드
          <Input
            value={inviteCode}
            maxLength={6}
            autoCapitalize="characters"
            onChange={(event) =>
              setInviteCode(
                event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              )
            }
            placeholder="6자리 코드 입력"
          />
        </Field>
        <Button
          $variant="primary"
          disabled={inviteCode.length !== 6 || !store.authUser}
          onClick={async () => {
            if (await store.acceptInvite(inviteCode)) setInviteCode("")
          }}
        >
          <Link size={16} /> 참여하기
        </Button>
      </Composer>

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
              <Button $variant="danger" disabled={member.role === "owner"}>
                <UserMinus size={15} /> 내보내기
              </Button>
            </Row>
          ))}
        </Rows>
      </Section>

      <Section>
        <SectionTitle>초대</SectionTitle>
        <Rows>
          {invitations.map((invitation) => (
            <Row key={invitation.id}>
              <Code>{invitation.inviteCode}</Code>
              <div>
                <strong>{invitationLabels[invitation.status]}</strong>
                <Meta>
                  {new Date(invitation.expiresAt).toLocaleDateString("ko-KR")}{" "}
                  만료
                </Meta>
              </div>
              <Button
                onClick={() =>
                  navigator.clipboard?.writeText(invitation.inviteCode)
                }
              >
                <Copy size={15} /> 복사
              </Button>
            </Row>
          ))}
          {invitations.length === 0 ? <Empty>초대 없음</Empty> : null}
        </Rows>
      </Section>
    </Panel>
  )
})

const Composer = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;
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
  color: ${colors.muted};
  font-size: 12px;
  margin-top: 2px;
`

const Code = styled.div`
  min-width: 76px;
  font-family: var(--font-geist-mono);
  font-weight: 650;
  color: ${colors.blue};
`

const Empty = styled.div`
  min-height: 56px;
  display: flex;
  align-items: center;
  color: ${colors.muted};
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
`
