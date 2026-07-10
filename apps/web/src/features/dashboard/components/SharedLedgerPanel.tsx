"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { Copy, Link, Plus, UserMinus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Field, Input, Panel, PanelHeader, PanelTitle } from "../styles"

export const SharedLedgerPanel = observer(function SharedLedgerPanel() {
  const store = useAppStore()
  const [name, setName] = useState("")
  const invitations = store.data.invitations.filter((invite) => invite.ledgerId === store.selectedLedgerId)

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>공동 가계부</PanelTitle>
        <Button $variant="primary" onClick={() => void store.createInvite()} disabled={!store.authUser || !store.selectedLedgerId}>
          <Link size={16} /> 초대 생성
        </Button>
      </PanelHeader>

      <Composer>
        <Field>
          새 공동 가계부
          <Input value={name} onChange={(event) => setName(event.target.value)} />
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

      <Section>
        <SectionTitle>멤버</SectionTitle>
        <Rows>
          {store.currentMembers.map((member) => (
            <Row key={member.id}>
              <Avatar>{member.nickname.slice(0, 1)}</Avatar>
              <div>
                <strong>{member.nickname}</strong>
                <Meta>{member.role}</Meta>
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
                <strong>{invitation.status}</strong>
                <Meta>{new Date(invitation.expiresAt).toLocaleDateString("ko-KR")} 만료</Meta>
              </div>
              <Button onClick={() => navigator.clipboard?.writeText(invitation.inviteCode)}>
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
`

const Section = styled.section`
  padding: 0 18px 18px;
`

const SectionTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 14px;
`

const Rows = styled.div`
  display: grid;
  gap: 8px;
`

const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  padding: 10px;
`

const Avatar = styled.div`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #eef7f4;
  color: ${colors.green};
  font-weight: 850;
`

const Meta = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  margin-top: 2px;
`

const Code = styled.div`
  min-width: 76px;
  font-family: var(--font-geist-mono);
  font-weight: 850;
  color: ${colors.teal};
`

const Empty = styled.div`
  min-height: 84px;
  display: grid;
  place-items: center;
  color: ${colors.muted};
  border: 1px dashed ${colors.border};
  border-radius: 8px;
`
