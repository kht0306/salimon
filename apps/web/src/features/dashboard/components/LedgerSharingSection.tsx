"use client"

import styled from "@emotion/styled"
import type { CreatedLedgerInvitation } from "@salimon/api-client"
import type { LedgerRole } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Copy, Link, Share2, ShieldCheck, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Panel, PanelHeader, PanelTitle, Select } from "../styles"

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

export const LedgerSharingSection = observer(function LedgerSharingSection() {
  const store = useAppStore()
  const ledger = store.currentLedger
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedLedgerInvitation | null>(null)
  const [inviteRole, setInviteRole] =
    useState<Exclude<LedgerRole, "owner">>("member")
  const invitations = store.data.invitations.filter(
    (invite) => invite.ledgerId === store.selectedLedgerId,
  )
  const memberEvents = store.data.memberEvents
    .filter((event) => event.ledgerId === store.selectedLedgerId)
    .slice(0, 20)
  const isArchived = Boolean(ledger?.archivedAt)
  const canManageShared = ledger?.role === "owner" || ledger?.role === "admin"

  return (
    <>
      {ledger?.type === "personal" && !isArchived ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>공동 사용</PanelTitle>
          </PanelHeader>
          <ConversionNotice>
            <ConversionHeader>
              <div>
                <strong>현재 개인 가계부를 함께 사용하기</strong>
                <p>
                  먼저 공동 가계부로 전환한 뒤 초대 코드를 만드세요. 거래,
                  카테고리, 현재 카드·계좌 연결은 그대로 유지되고 전환 직후에는
                  모두 나만 보기 상태입니다.
                </p>
              </div>
              <Button
                type="button"
                $variant="primary"
                disabled={ledger.ownerId !== store.authUser?.id}
                onClick={() => {
                  if (
                    window.confirm(
                      "현재 개인 가계부를 공동 가계부로 전환하시겠습니까? 기존 데이터와 결제수단 연결은 유지되며 개인 가계부로 되돌릴 수 없습니다.",
                    )
                  ) {
                    void store.convertCurrentLedgerToShared()
                  }
                }}
              >
                <Share2 size={15} /> 공동 가계부로 전환
              </Button>
            </ConversionHeader>
            <ConversionSteps>
              <span>1. 공동 가계부로 전환</span>
              <span>2. 공개할 카드·계좌 선택</span>
              <span>3. 초대 코드 생성·전달</span>
              <span>4. 상대방이 코드로 참여</span>
            </ConversionSteps>
          </ConversionNotice>
        </Panel>
      ) : null}

      {ledger?.type === "shared" && !isArchived ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>공동 멤버와 초대</PanelTitle>
            <InviteActions>
              <Select
                aria-label="초대할 멤버 역할"
                value={inviteRole}
                disabled={!canManageShared}
                onChange={(event) =>
                  setInviteRole(
                    event.target.value as Exclude<LedgerRole, "owner">,
                  )
                }
              >
                {ledger.role === "owner" ? (
                  <option value="admin">관리자</option>
                ) : null}
                <option value="member">멤버</option>
                <option value="viewer">뷰어</option>
              </Select>
              <Button
                type="button"
                $variant="primary"
                onClick={async () => {
                  const invitation = await store.createInvite(inviteRole)
                  if (invitation) setCreatedInvitation(invitation)
                }}
                disabled={!store.authUser || !canManageShared}
                title={
                  canManageShared
                    ? "초대 코드 생성"
                    : "소유자와 관리자만 초대할 수 있습니다."
                }
              >
                <Link size={16} /> 초대 코드 생성
              </Button>
            </InviteActions>
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
                  {member.role !== "owner" &&
                  (ledger.role === "owner" ||
                    (ledger.role === "admin" && member.role !== "admin")) ? (
                    <MemberActions>
                      {ledger.role === "owner" ? (
                        <RoleSelect
                          aria-label={`${member.nickname} 역할`}
                          value={member.role}
                          onChange={(event) =>
                            void store.updateMemberRole(
                              member.userId,
                              event.target.value as Exclude<
                                LedgerRole,
                                "owner"
                              >,
                            )
                          }
                        >
                          <option value="admin">관리자</option>
                          <option value="member">멤버</option>
                          <option value="viewer">뷰어</option>
                        </RoleSelect>
                      ) : null}
                      {ledger.role === "owner" ? (
                        <Button
                          type="button"
                          title="소유권 이전"
                          onClick={() => {
                            if (
                              window.confirm(
                                `${member.nickname}님에게 소유권을 이전하시겠습니까? 이전 후 본인은 관리자가 됩니다.`,
                              )
                            ) {
                              void store.transferLedgerOwnership(member.userId)
                            }
                          }}
                        >
                          <ShieldCheck size={14} /> 소유권 이전
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        $variant="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `${member.nickname}님을 공동 가계부에서 내보내시겠습니까? 기존 거래 기록은 유지됩니다.`,
                            )
                          ) {
                            void store.removeMember(member.userId)
                          }
                        }}
                      >
                        <Trash2 size={14} /> 내보내기
                      </Button>
                    </MemberActions>
                  ) : null}
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
          {memberEvents.length > 0 ? (
            <Section>
              <SectionTitle>최근 멤버 권한 기록</SectionTitle>
              <EventRows>
                {memberEvents.map((event) => {
                  const actor =
                    store.data.members.find(
                      (member) => member.userId === event.actorUserId,
                    )?.nickname ?? "탈퇴한 멤버"
                  const target =
                    store.data.members.find(
                      (member) => member.userId === event.targetUserId,
                    )?.nickname ?? "탈퇴한 멤버"
                  const description =
                    event.action === "removed"
                      ? `${target} 내보내기`
                      : event.action === "ownership_transferred"
                        ? `${target}에게 소유권 이전`
                        : `${target} 역할: ${event.previousRole ? roleLabels[event.previousRole] : "-"} → ${event.nextRole ? roleLabels[event.nextRole] : "-"}`
                  return (
                    <EventRow key={event.id}>
                      <span>{description}</span>
                      <small>
                        {actor} ·{" "}
                        {new Date(event.createdAt).toLocaleString("ko-KR")}
                      </small>
                    </EventRow>
                  )
                })}
              </EventRows>
            </Section>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
})

const ConversionNotice = styled.div`
  display: grid;
  gap: 16px;
  padding: 16px 18px;
  background: ${colors.tealSoft};

  p {
    margin: 4px 0 0;
    color: ${colors.muted};
    font-size: 12px;
  }
`

const ConversionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  > div {
    min-width: 0;
  }

  > button {
    flex: 0 0 auto;
  }

  @media (max-width: 640px) {
    align-items: stretch;
    flex-direction: column;

    > button {
      width: 100%;
    }
  }
`

const ConversionSteps = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  span {
    border: 1px solid ${colors.border};
    border-radius: ${radii.sm};
    background: ${colors.panel};
    padding: 9px 10px;
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 650;
  }

  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 460px) {
    grid-template-columns: 1fr;
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

const InviteActions = styled.div`
  display: flex;
  gap: 7px;

  select {
    min-width: 96px;
  }

  @media (max-width: 620px) {
    width: 100%;
    select,
    button {
      flex: 1;
    }
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;

  @media (max-width: 720px) {
    grid-template-columns: auto minmax(0, 1fr);
  }
`

const MemberActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;

  @media (max-width: 720px) {
    grid-column: 1 / -1;
    justify-content: flex-start;
    padding-left: 44px;
  }
`

const RoleSelect = styled(Select)`
  width: auto;
  min-width: 92px;
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

const EventRows = styled.div`
  display: grid;
  gap: 7px;
  padding-bottom: 12px;
`

const EventRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid ${colors.border};
  padding: 8px 0;
  font-size: 11px;

  small {
    color: ${colors.muted};
    white-space: nowrap;
  }

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
`
