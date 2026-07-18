"use client"

import styled from "@emotion/styled"
import type { CreatedLedgerInvitation } from "@salimon/api-client"
import type { LedgerType, PaymentInstrument } from "@salimon/types"
import { colors, radii, spacing } from "@salimon/ui-tokens"
import {
  Archive,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Link,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Users,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useId, useState } from "react"
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
  const [newLedgerPaymentMethodIds, setNewLedgerPaymentMethodIds] = useState<
    string[]
  >([])
  const [newLedgerVisibleMethodIds, setNewLedgerVisibleMethodIds] = useState<
    string[]
  >([])
  const [inviteCode, setInviteCode] = useState("")
  const [showJoinedSetup, setShowJoinedSetup] = useState(false)
  const [connectedPaymentMethodIds, setConnectedPaymentMethodIds] = useState<
    string[]
  >([])
  const [visiblePaymentMethodIds, setVisiblePaymentMethodIds] = useState<
    string[]
  >([])
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
  const conversionPaymentMethods = store.myPaymentInstruments
  const allConversionMethodsSelected =
    conversionPaymentMethods.length > 0 &&
    conversionPaymentMethods.every((method) =>
      sharedPaymentMethodIds.includes(method.id),
    )

  useEffect(() => {
    setRenameName(ledger?.name ?? "")
    const ownedLinks = store.data.paymentMethods.filter(
      (method) =>
        method.ledgerId === ledger?.id &&
        (method.type === "card" || method.type === "bank") &&
        !method.isDeleted &&
        method.ownerUserId === store.authUser?.id &&
        method.isActive,
    )
    setConnectedPaymentMethodIds(
      ownedLinks.map((method) => method.instrumentId),
    )
    setVisiblePaymentMethodIds(
      ownedLinks
        .filter((method) => method.visibility === "ledger")
        .map((method) => method.instrumentId),
    )
  }, [ledger?.id, ledger?.name, store.authUser?.id, store.data.paymentMethods])

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
          <FormAction
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
          </FormAction>
        </FormRow>

        {!canRename && ledger ? (
          <PermissionNotice>
            이 가계부의 이름을 변경할 권한이 없습니다.
          </PermissionNotice>
        ) : null}
        {ledger ? (
          <DangerActions>
            {ledger.role !== "owner" && ledger.type === "shared" ? (
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
            ) : null}
            {ledger.ownerId === store.authUser?.id ? (
              <Button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "가계부를 보관하시겠습니까? 30일 동안 복구할 수 있으며 카드·계좌 원본은 유지됩니다.",
                    )
                  ) {
                    void store.archiveCurrentLedger()
                  }
                }}
              >
                <Archive size={15} /> 가계부 보관
              </Button>
            ) : null}
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
          {store.myPaymentInstruments.length > 0 ? (
            <NewLedgerPaymentMethods>
              <strong>연결할 내 카드·계좌</strong>
              <span>
                선택하지 않아도 가계부를 만들 수 있습니다. 공동 공개는 별도로
                선택합니다.
              </span>
              <PaymentInstrumentSelector
                instruments={store.myPaymentInstruments}
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
              await store.createLedger({
                name: newName,
                type: newType,
                setDefault: setAsDefault,
                paymentInstrumentIds: newLedgerPaymentMethodIds,
                ledgerVisibleInstrumentIds:
                  newType === "shared" ? newLedgerVisibleMethodIds : [],
              })
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
                setShowJoinedSetup(true)
              } else if (result?.status === "already_member") {
                setInviteCode("")
              }
            }}
          >
            <Link size={16} /> 참여하기
          </FormAction>
        </JoinRow>
      </Panel>

      {ledger?.type === "shared" ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>
              {showJoinedSetup
                ? "참여 완료 · 내 카드·계좌 연결"
                : "내 카드·계좌 연결"}
            </PanelTitle>
          </PanelHeader>
          <PaymentSetupBody>
            <p>
              이 가계부에서 사용할 내 카드·계좌를 선택하세요. 연결을 해제해도
              카드·계좌 원본과 기존 거래는 삭제되지 않습니다.
            </p>
            {store.myPaymentInstruments.length > 0 ? (
              <PaymentInstrumentSelector
                instruments={store.myPaymentInstruments}
                selectedIds={connectedPaymentMethodIds}
                visibleIds={visiblePaymentMethodIds}
                allowVisibility
                disabled={isMutating}
                onSelectedIdsChange={setConnectedPaymentMethodIds}
                onVisibleIdsChange={setVisiblePaymentMethodIds}
              />
            ) : (
              <EmptyPaymentMethods>
                먼저 카드 또는 계좌 메뉴에서 내 결제수단을 등록해 주세요.
              </EmptyPaymentMethods>
            )}
            <PaymentSetupActions>
              {showJoinedSetup ? (
                <Button type="button" onClick={() => setShowJoinedSetup(false)}>
                  나중에 하기
                </Button>
              ) : null}
              <Button
                type="button"
                $variant="primary"
                disabled={isMutating || store.myPaymentInstruments.length === 0}
                onClick={async () => {
                  if (
                    await store.syncMyLedgerPaymentMethods(
                      connectedPaymentMethodIds,
                      visiblePaymentMethodIds,
                    )
                  ) {
                    setShowJoinedSetup(false)
                  }
                }}
              >
                {store.ledgerMutationState === "syncing-payment-methods"
                  ? "저장 중"
                  : "연결 저장"}
              </Button>
            </PaymentSetupActions>
          </PaymentSetupBody>
        </Panel>
      ) : null}

      {ledger?.type === "personal" ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>공동 사용</PanelTitle>
          </PanelHeader>
          <ConversionNotice>
            <ConversionHeader>
              <div>
                <strong>현재 개인 가계부를 함께 사용하기</strong>
                <p>
                  거래와 카테고리는 그대로 유지됩니다. 아래에서 선택한 카드와
                  계좌만 공동 멤버에게 공개되며, 선택하지 않은 결제수단은 나만
                  볼 수 있습니다.
                </p>
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
            </ConversionHeader>
            <PaymentMethodChoices>
              {conversionPaymentMethods.length > 0 ? (
                <SelectAllChoice
                  type="button"
                  aria-pressed={allConversionMethodsSelected}
                  $selected={allConversionMethodsSelected}
                  onClick={() =>
                    setSharedPaymentMethodIds(
                      allConversionMethodsSelected
                        ? []
                        : conversionPaymentMethods.map((method) => method.id),
                    )
                  }
                >
                  <span>
                    {allConversionMethodsSelected ? <Check size={14} /> : null}
                  </span>
                  전체 결제수단 공개
                </SelectAllChoice>
              ) : null}
              {conversionPaymentMethods.map((method) => (
                <ConversionMethodChoice
                  key={method.id}
                  type="button"
                  aria-pressed={sharedPaymentMethodIds.includes(method.id)}
                  $selected={sharedPaymentMethodIds.includes(method.id)}
                  onClick={() =>
                    setSharedPaymentMethodIds((current) =>
                      current.includes(method.id)
                        ? current.filter((id) => id !== method.id)
                        : [...current, method.id],
                    )
                  }
                >
                  <MethodIcon aria-hidden="true">
                    {method.type === "card" ? (
                      <CreditCard size={17} />
                    ) : (
                      <Landmark size={17} />
                    )}
                  </MethodIcon>
                  <MethodDetails>
                    <strong>{method.name}</strong>
                    <span>
                      {getPaymentMethodTypeLabel(method)}
                      {method.issuer ? ` · ${method.issuer}` : ""}
                      {method.last4 ? ` · •••• ${method.last4}` : ""}
                    </span>
                  </MethodDetails>
                  <SelectionStatus>
                    {sharedPaymentMethodIds.includes(method.id) ? (
                      <>
                        <Check size={14} /> 공개
                      </>
                    ) : (
                      "나만 보기"
                    )}
                  </SelectionStatus>
                </ConversionMethodChoice>
              ))}
              {conversionPaymentMethods.length === 0 ? (
                <span>등록된 카드와 계좌가 없습니다.</span>
              ) : null}
            </PaymentMethodChoices>
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
              <Link size={16} /> 초대 코드 생성
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

interface PaymentInstrumentSelectorProps {
  instruments: PaymentInstrument[]
  selectedIds: string[]
  visibleIds: string[]
  allowVisibility: boolean
  disabled: boolean
  onSelectedIdsChange: (ids: string[]) => void
  onVisibleIdsChange: (ids: string[]) => void
}

function getPaymentMethodTypeLabel(
  method: Pick<PaymentInstrument, "type" | "isDebit">,
) {
  if (method.type === "card") {
    return method.isDebit ? "체크카드" : "신용카드"
  }
  if (method.type === "bank") return "계좌"
  return "결제수단"
}

function PaymentInstrumentSelector({
  instruments,
  selectedIds,
  visibleIds,
  allowVisibility,
  disabled,
  onSelectedIdsChange,
  onVisibleIdsChange,
}: PaymentInstrumentSelectorProps) {
  const visibilityInputName = useId()
  const allIds = instruments.map((method) => method.id)
  const selectedCount = allIds.filter((id) => selectedIds.includes(id)).length
  const allSelected =
    instruments.length > 0 && selectedCount === instruments.length
  const visibleSelectedCount = selectedIds.filter((id) =>
    visibleIds.includes(id),
  ).length
  const visibilityMode =
    selectedCount === 0 || visibleSelectedCount === 0
      ? "private"
      : visibleSelectedCount === selectedCount
        ? "ledger"
        : "mixed"

  function setConnected(methodId: string, connected: boolean) {
    const nextSelectedIds = connected
      ? [...selectedIds, methodId]
      : selectedIds.filter((id) => id !== methodId)
    onSelectedIdsChange(nextSelectedIds)
    if (!connected) {
      onVisibleIdsChange(visibleIds.filter((id) => id !== methodId))
    } else if (visibilityMode === "ledger") {
      onVisibleIdsChange([...visibleIds, methodId])
    }
  }

  return (
    <PaymentMethodOptions>
      <SelectorToolbar>
        <div>
          <strong>연결할 결제수단</strong>
          <span>
            {selectedCount > 0
              ? `${instruments.length}개 중 ${selectedCount}개 선택`
              : "연결할 카드·계좌를 선택하세요"}
          </span>
        </div>
        <SelectAllOption
          type="button"
          aria-pressed={allSelected}
          disabled={disabled}
          $selected={allSelected}
          onClick={() => {
            onSelectedIdsChange(allSelected ? [] : allIds)
            if (allSelected) {
              onVisibleIdsChange([])
            } else if (visibilityMode === "ledger") {
              onVisibleIdsChange(allIds)
            }
          }}
        >
          {allSelected ? <Check size={14} /> : null}
          {allSelected ? "전체 선택됨" : "전체 선택"}
        </SelectAllOption>
      </SelectorToolbar>
      {instruments.map((method) => {
        const isConnected = selectedIds.includes(method.id)
        return (
          <PaymentMethodOption
            key={method.id}
            type="button"
            aria-pressed={isConnected}
            disabled={disabled}
            $selected={isConnected}
            onClick={() => setConnected(method.id, !isConnected)}
          >
            <MethodIcon aria-hidden="true">
              {method.type === "card" ? (
                <CreditCard size={18} />
              ) : (
                <Landmark size={18} />
              )}
            </MethodIcon>
            <MethodDetails>
              <strong>{method.name}</strong>
              <span>
                {getPaymentMethodTypeLabel(method)}
                {method.issuer ? ` · ${method.issuer}` : ""}
                {method.last4 ? ` · •••• ${method.last4}` : ""}
              </span>
            </MethodDetails>
            <SelectionStatus>
              {isConnected ? (
                <>
                  <Check size={14} /> 연결됨
                </>
              ) : (
                "연결"
              )}
            </SelectionStatus>
          </PaymentMethodOption>
        )
      })}
      {allowVisibility && selectedCount > 0 ? (
        <VisibilityFieldset>
          <legend>공개 범위</legend>
          <VisibilityHelp>
            {visibilityMode === "mixed"
              ? "현재 결제수단별 공개 범위가 달라요. 아래 범위를 선택하면 연결된 전체 결제수단에 적용됩니다."
              : "연결한 카드·계좌가 공동 멤버에게 보일지 선택하세요."}
          </VisibilityHelp>
          <VisibilityChoices>
            <VisibilityChoice $selected={visibilityMode === "private"}>
              <input
                type="radio"
                name={visibilityInputName}
                checked={visibilityMode === "private"}
                disabled={disabled}
                onChange={() => onVisibleIdsChange([])}
              />
              <Lock size={19} aria-hidden="true" />
              <span>
                <strong>나만 보기</strong>
                <small>연결한 자산은 내 화면에만 표시돼요.</small>
              </span>
              {visibilityMode === "private" ? (
                <Check size={16} aria-hidden="true" />
              ) : null}
            </VisibilityChoice>
            <VisibilityChoice $selected={visibilityMode === "ledger"}>
              <input
                type="radio"
                name={visibilityInputName}
                checked={visibilityMode === "ledger"}
                disabled={disabled}
                onChange={() => onVisibleIdsChange(selectedIds)}
              />
              <Users size={19} aria-hidden="true" />
              <span>
                <strong>공동 멤버와 보기</strong>
                <small>멤버에게 카드·계좌와 연결된 거래가 보여요.</small>
              </span>
              {visibilityMode === "ledger" ? (
                <Check size={16} aria-hidden="true" />
              ) : null}
            </VisibilityChoice>
          </VisibilityChoices>
          <VisibilityStatus $shared={visibilityMode === "ledger"}>
            {visibilityMode === "ledger"
              ? `선택한 ${selectedCount}개 결제수단을 공동 멤버와 공유합니다.`
              : visibilityMode === "private"
                ? `선택한 ${selectedCount}개 결제수단은 나만 볼 수 있습니다.`
                : `${visibleSelectedCount}개는 공개, ${selectedCount - visibleSelectedCount}개는 나만 보기 상태입니다.`}
          </VisibilityStatus>
        </VisibilityFieldset>
      ) : null}
    </PaymentMethodOptions>
  )
}

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
  align-items: start;
  padding: 16px 18px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const FormAction = styled(Button)`
  align-self: start;
  margin-top: 21px;

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

const PaymentMethodOptions = styled.div`
  display: grid;
  gap: 10px;
`

const SelectorToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 2px;

  > div {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 12px;
  }

  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`

const SelectAllOption = styled.button<{ $selected: boolean }>`
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.borderStrong)};
  border-radius: ${radii.sm};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.ink)};
  padding: 0 10px;
  font-size: 11px;
  font-weight: 650;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const PaymentMethodOption = styled.button<{ $selected: boolean }>`
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.border)};
  border-radius: ${radii.md};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${colors.ink};
  padding: 10px 12px;
  text-align: left;

  &:hover:not(:disabled) {
    border-color: ${({ $selected }) =>
      $selected ? colors.teal : colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const MethodIcon = styled.span`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  color: ${colors.teal};
`

const MethodDetails = styled.span`
  min-width: 0;
  display: grid;
  gap: 3px;

  strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: ${colors.muted};
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const SelectionStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${colors.teal};
  font-size: 11px;
  font-weight: 650;
`

const VisibilityFieldset = styled.fieldset`
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  padding: 12px;

  legend {
    padding: 0 5px;
    color: ${colors.ink};
    font-size: 12px;
    font-weight: 700;
  }
`

const VisibilityHelp = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 11px;
`

const VisibilityChoices = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const VisibilityChoice = styled.label<{ $selected: boolean }>`
  position: relative;
  min-width: 0;
  min-height: 72px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.border)};
  border-radius: ${radii.md};
  background: ${({ $selected }) =>
    $selected ? colors.tealSoft : colors.panel};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.ink)};
  padding: 11px 12px;
  cursor: pointer;

  &:has(input:focus-visible) {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  &:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }

  > input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  > span {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  strong {
    color: ${colors.ink};
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    line-height: 1.4;
  }
`

const VisibilityStatus = styled.div<{ $shared: boolean }>`
  border-left: 3px solid
    ${({ $shared }) => ($shared ? colors.teal : colors.borderStrong)};
  background: ${({ $shared }) =>
    $shared ? colors.tealSoft : colors.panelSubtle};
  color: ${({ $shared }) => ($shared ? colors.teal : colors.muted)};
  padding: 8px 10px;
  font-size: 11px;
`

const PaymentSetupBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 16px 18px;

  > p {
    margin: 0;
    color: ${colors.muted};
    font-size: 12px;
  }
`

const PaymentSetupActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const EmptyPaymentMethods = styled.div`
  padding: 12px;
  border: 1px dashed ${colors.border};
  border-radius: ${radii.md};
  color: ${colors.muted};
  font-size: 12px;
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

const PaymentMethodChoices = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 12px;

  > span {
    color: ${colors.muted};
    font-size: 12px;
  }
`

const SelectAllChoice = styled.button<{ $selected: boolean }>`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid
    ${({ $selected }) => ($selected ? colors.teal : colors.borderStrong)};
  border-radius: ${radii.sm};
  background: ${({ $selected }) =>
    $selected ? colors.panel : "rgba(255, 255, 255, 0.6)"};
  color: ${({ $selected }) => ($selected ? colors.teal : colors.ink)};
  padding: 0 10px;
  font-size: 11px;
  font-weight: 650;

  > span {
    width: 17px;
    height: 17px;
    display: grid;
    place-items: center;
    border: 1px solid
      ${({ $selected }) => ($selected ? colors.teal : colors.borderStrong)};
    border-radius: ${radii.xs};
  }
`

const ConversionMethodChoice = styled(PaymentMethodOption)`
  background: ${({ $selected }) =>
    $selected ? colors.panel : "rgba(255, 255, 255, 0.6)"};
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
