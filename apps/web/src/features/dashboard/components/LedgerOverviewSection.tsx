"use client"

import styled from "@emotion/styled"
import { colors, spacing } from "@salimon/ui-tokens"
import { Pencil, RotateCcw, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  RequiredMark,
} from "../styles"

const roleLabels = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  viewer: "뷰어",
} as const

export const LedgerOverviewSection = observer(function LedgerOverviewSection() {
  const store = useAppStore()
  const ledger = store.currentLedger
  const [renameName, setRenameName] = useState(ledger?.name ?? "")
  const isArchived = Boolean(ledger?.archivedAt)
  const isDefaultLedger = Boolean(store.currentMembership?.isDefault)
  const canRename = Boolean(
    ledger &&
    !isArchived &&
    (ledger.type === "personal"
      ? ledger.ownerId === store.authUser?.id
      : ledger.role === "owner" || ledger.role === "admin"),
  )
  const isMutating = store.ledgerMutationState !== "idle"

  useEffect(() => {
    setRenameName(ledger?.name ?? "")
  }, [ledger?.id, ledger?.name, store.authUser?.id, store.data.paymentMethods])

  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>{ledger ? "현재 가계부" : "가계부 시작하기"}</PanelTitle>
          {ledger ? (
            <LedgerMeta>
              {ledger.type === "shared" ? "공동" : "개인"} ·{" "}
              {roleLabels[ledger.role]}
              {isArchived ? " · 보관중" : ""}
            </LedgerMeta>
          ) : null}
        </PanelHeader>

        {ledger ? (
          <FormRow>
            <Field>
              <span>
                가계부 이름<RequiredMark>*</RequiredMark>
              </span>
              <Input
                value={renameName}
                maxLength={30}
                disabled={!canRename || isMutating || isArchived}
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
            <CurrentLedgerActions>
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
                {store.ledgerMutationState === "renaming"
                  ? "이름 변경 중"
                  : "가계부 이름 변경"}
              </Button>
              {ledger?.ownerId === store.authUser?.id && !isArchived ? (
                <Button
                  type="button"
                  $variant="danger"
                  disabled={isDefaultLedger || isMutating}
                  aria-describedby={
                    isDefaultLedger ? "default-ledger-removal-help" : undefined
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        "가계부를 제거하시겠습니까? 30일 동안 복구할 수 있으며 카드·계좌 원본은 유지됩니다.",
                      )
                    ) {
                      void store.archiveCurrentLedger()
                    }
                  }}
                >
                  <Trash2 size={15} />
                  {store.ledgerMutationState === "archiving"
                    ? "제거 중"
                    : "가계부 제거"}
                </Button>
              ) : null}
              {ledger && ledger.ownerId === store.authUser?.id && isArchived ? (
                <Button
                  type="button"
                  $variant="soft"
                  disabled={isMutating}
                  onClick={() => void store.restoreLedger(ledger.id)}
                >
                  <RotateCcw size={15} />
                  {store.ledgerMutationState === "restoring"
                    ? "복구 중"
                    : "가계부 복구"}
                </Button>
              ) : null}
            </CurrentLedgerActions>
          </FormRow>
        ) : (
          <EmptyLedgerNotice>
            <strong>아직 참여 중인 가계부가 없습니다.</strong>
            <span>
              아래에서 새 가계부를 만들거나, 받은 초대 코드로 공동 가계부에
              참여해 주세요.
            </span>
          </EmptyLedgerNotice>
        )}

        {isDefaultLedger && !isArchived ? (
          <RemovalNotice id="default-ledger-removal-help">
            현재 기본 가계부입니다. 다른 가계부를 기본 가계부로 설정한 후 제거할
            수 있습니다.
          </RemovalNotice>
        ) : null}
        {isArchived && ledger ? (
          <RemovalNotice>
            보관중인 가계부입니다.
            {ledger.purgeAfter
              ? ` ${new Date(ledger.purgeAfter).toLocaleDateString("ko-KR")}까지 복구할 수 있습니다.`
              : " 삭제 전까지 복구할 수 있습니다."}
          </RemovalNotice>
        ) : null}
        {!canRename && ledger && !isArchived ? (
          <PermissionNotice>
            이 가계부의 이름을 변경할 권한이 없습니다.
          </PermissionNotice>
        ) : null}
        {ledger?.role !== "owner" &&
        ledger?.type === "shared" &&
        !isArchived ? (
          <DangerActions>
            <Button
              type="button"
              onClick={() => {
                if (window.confirm("이 공동 가계부에서 나가시겠습니까?")) {
                  void store.leaveCurrentSharedLedger()
                }
              }}
            >
              공동 가계부 나가기
            </Button>
          </DangerActions>
        ) : null}
      </Panel>

      {store.archivedOwnedLedgers.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>보관한 가계부</PanelTitle>
          </PanelHeader>
          <ArchivedLedgers>
            {store.archivedOwnedLedgers.map((archivedLedger) => (
              <div key={archivedLedger.id}>
                <span>
                  <strong>{archivedLedger.name}</strong>
                  {archivedLedger.purgeAfter
                    ? ` · ${new Date(archivedLedger.purgeAfter).toLocaleDateString("ko-KR")}까지 복구 가능`
                    : ""}
                </span>
                <Button
                  type="button"
                  onClick={() => void store.restoreLedger(archivedLedger.id)}
                >
                  <RotateCcw size={15} /> 복구
                </Button>
              </div>
            ))}
          </ArchivedLedgers>
        </Panel>
      ) : null}
    </>
  )
})

const LedgerMeta = styled.span`
  color: ${colors.muted};
  font-size: 12px;
`

const EmptyLedgerNotice = styled.div`
  display: grid;
  gap: ${spacing[2]};
  padding: ${spacing[5]};
  color: ${colors.ink};

  span {
    color: ${colors.muted};
    font-size: 13px;
    line-height: 1.6;
  }
`

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
const CurrentLedgerActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  margin-top: 26px;

  @media (max-width: 640px) {
    display: grid;
    grid-template-columns: 1fr;
    margin-top: 0;

    button {
      width: 100%;
      justify-content: center;
    }
  }
`

const RemovalNotice = styled.p`
  margin: 0;
  padding: 0 18px 16px;
  color: ${colors.muted};
  font-size: 12px;
  line-height: 1.5;
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

const DangerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 18px 16px;
`

const ArchivedLedgers = styled.div`
  display: grid;
  padding: 8px 18px;

  > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid ${colors.border};
    color: ${colors.muted};
    font-size: 12px;
  }
`
