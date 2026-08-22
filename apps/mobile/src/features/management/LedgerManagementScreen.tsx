import type { LedgerMember, LedgerRole, LedgerType } from "@salimon/types"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { Alert, Switch } from "react-native"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import {
  ChoiceButton,
  ChoiceLabel,
  ErrorText,
  Field,
  FieldLabel,
  InlineRow,
  Input,
  ItemCard,
  ItemMeta,
  ItemTitle,
  ManagementScaffold,
  NoticeText,
  SectionCard,
  SectionDescription,
  SectionHeading,
  SectionTitle,
  TextButton,
  TextButtonLabel,
} from "./ManagementUI"

type GrantableRole = Exclude<LedgerRole, "owner">

const roleOptions: { label: string; value: GrantableRole }[] = [
  { label: "관리자", value: "admin" },
  { label: "멤버", value: "member" },
  { label: "조회자", value: "viewer" },
]

export const LedgerManagementScreen = observer(
  function LedgerManagementScreen() {
    const store = useMobileAppStore()
    const ledger = store.currentLedger
    const [renameValue, setRenameValue] = useState(ledger?.name ?? "")
    const [createName, setCreateName] = useState("")
    const [createType, setCreateType] = useState<LedgerType>("personal")
    const [createDefault, setCreateDefault] = useState(false)
    const [createConnectedIds, setCreateConnectedIds] = useState<string[]>([])
    const [createVisibleIds, setCreateVisibleIds] = useState<string[]>([])
    const [inviteCode, setInviteCode] = useState("")
    const [inviteRole, setInviteRole] = useState<GrantableRole>("member")
    const [createdInviteCode, setCreatedInviteCode] = useState("")
    const busy = store.managementMutationState !== "idle"
    const canAdministerShared =
      ledger?.type === "shared" &&
      (ledger.role === "owner" || ledger.role === "admin")
    const activeInvitations = store.financeData.invitations.filter(
      (invitation) =>
        invitation.ledgerId === ledger?.id && invitation.status === "active",
    )

    useEffect(() => {
      store.clearManagementFeedback()
    }, [store])

    useEffect(() => {
      setRenameValue(ledger?.name ?? "")
      setCreatedInviteCode("")
    }, [ledger?.id, ledger?.name])

    function toggleCreateInstrument(instrumentId: string): void {
      const selected = createConnectedIds.includes(instrumentId)
      setCreateConnectedIds((ids) =>
        selected
          ? ids.filter((id) => id !== instrumentId)
          : [...ids, instrumentId],
      )
      if (selected) {
        setCreateVisibleIds((ids) => ids.filter((id) => id !== instrumentId))
      }
    }

    async function createLedger(): Promise<void> {
      const created = await store.createLedger({
        ledgerVisibleInstrumentIds:
          createType === "shared" ? createVisibleIds : [],
        name: createName,
        paymentInstrumentIds: createConnectedIds,
        setDefault: createDefault,
        type: createType,
      })
      if (created) {
        setCreateName("")
        setCreateDefault(false)
        setCreateConnectedIds([])
        setCreateVisibleIds([])
      }
    }

    async function createInvitation(): Promise<void> {
      const invitation = await store.createInvite(inviteRole)
      if (invitation) setCreatedInviteCode(invitation.inviteCode)
    }

    function confirmConvert(): void {
      Alert.alert(
        "공동 가계부로 전환할까요?",
        "전환 후에는 다시 개인 가계부로 되돌릴 수 없습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "전환",
            onPress: () => void store.convertCurrentLedgerToShared(),
          },
        ],
      )
    }

    function confirmArchive(): void {
      Alert.alert(
        "가계부를 보관할까요?",
        "30일 동안 복원할 수 있으며 기본 가계부는 보관할 수 없습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "보관",
            style: "destructive",
            onPress: () => void store.archiveCurrentLedger(),
          },
        ],
      )
    }

    function confirmLeave(): void {
      Alert.alert(
        "공동 가계부에서 나갈까요?",
        "다시 참여하려면 새 초대 코드가 필요합니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "나가기",
            style: "destructive",
            onPress: () => void store.leaveCurrentSharedLedger(),
          },
        ],
      )
    }

    return (
      <ManagementScaffold
        description="가계부 생명주기와 공동 멤버 권한을 모바일에서 관리합니다."
        title="가계부·공동 관리"
      >
        {store.managementErrorMessage ? (
          <ErrorText accessibilityRole="alert">
            {store.managementErrorMessage}
          </ErrorText>
        ) : null}
        {store.managementNoticeMessage ? (
          <NoticeText accessibilityLiveRegion="polite">
            {store.managementNoticeMessage}
          </NoticeText>
        ) : null}

        {ledger ? (
          <SectionCard>
            <SectionTitle>현재 가계부</SectionTitle>
            <SectionDescription>
              {ledger.type === "shared" ? "공동" : "개인"} ·{" "}
              {roleLabel(ledger.role)}
              {store.currentMembership?.isDefault ? " · 기본 가계부" : ""}
            </SectionDescription>
            <Field>
              <FieldLabel>가계부 이름</FieldLabel>
              <Input
                accessibilityLabel="가계부 이름"
                maxLength={30}
                value={renameValue}
                onChangeText={setRenameValue}
              />
            </Field>
            <InlineRow>
              <TextButton
                disabled={busy || renameValue.trim() === ledger.name}
                onPress={() => void store.renameCurrentLedger(renameValue)}
              >
                <TextButtonLabel>이름 저장</TextButtonLabel>
              </TextButton>
              {!store.currentMembership?.isDefault ? (
                <TextButton
                  disabled={busy}
                  onPress={() => void store.setDefaultLedger(ledger.id)}
                >
                  <TextButtonLabel>기본으로 설정</TextButtonLabel>
                </TextButton>
              ) : null}
              {ledger.type === "personal" &&
              ledger.ownerId === store.authUser?.id ? (
                <TextButton disabled={busy} onPress={confirmConvert}>
                  <TextButtonLabel>공동으로 전환</TextButtonLabel>
                </TextButton>
              ) : null}
              {ledger.ownerId === store.authUser?.id ? (
                <TextButton $danger disabled={busy} onPress={confirmArchive}>
                  <TextButtonLabel $danger>가계부 보관</TextButtonLabel>
                </TextButton>
              ) : ledger.type === "shared" ? (
                <TextButton $danger disabled={busy} onPress={confirmLeave}>
                  <TextButtonLabel $danger>가계부 나가기</TextButtonLabel>
                </TextButton>
              ) : null}
            </InlineRow>
          </SectionCard>
        ) : null}

        <SectionCard>
          <SectionTitle>새 가계부</SectionTitle>
          <Field>
            <FieldLabel>이름 *</FieldLabel>
            <Input
              accessibilityLabel="새 가계부 이름"
              maxLength={30}
              placeholder="예: 가족 생활비"
              value={createName}
              onChangeText={setCreateName}
            />
          </Field>
          <InlineRow>
            {(["personal", "shared"] as const).map((type) => (
              <ChoiceButton
                key={type}
                $selected={createType === type}
                accessibilityRole="radio"
                accessibilityState={{ selected: createType === type }}
                onPress={() => setCreateType(type)}
              >
                <ChoiceLabel $selected={createType === type}>
                  {type === "personal" ? "개인" : "공동"}
                </ChoiceLabel>
              </ChoiceButton>
            ))}
          </InlineRow>
          <SectionHeading>
            <FieldLabel>만든 뒤 기본 가계부로 설정</FieldLabel>
            <Switch
              accessibilityLabel="새 가계부를 기본으로 설정"
              trackColor={{
                false: mobileTheme.colors.borderStrong,
                true: mobileTheme.colors.teal,
              }}
              value={createDefault}
              onValueChange={setCreateDefault}
            />
          </SectionHeading>
          {store.myPaymentInstruments.length > 0 ? (
            <Field>
              <FieldLabel>처음 연결할 카드·계좌</FieldLabel>
              {store.myPaymentInstruments
                .filter((instrument) => instrument.isActive)
                .map((instrument) => {
                  const selected = createConnectedIds.includes(instrument.id)
                  const visible = createVisibleIds.includes(instrument.id)
                  return (
                    <ItemCard key={`create-${instrument.id}`}>
                      <ItemTitle>{instrument.name}</ItemTitle>
                      <InlineRow>
                        <ChoiceButton
                          $selected={selected}
                          onPress={() => toggleCreateInstrument(instrument.id)}
                        >
                          <ChoiceLabel $selected={selected}>연결</ChoiceLabel>
                        </ChoiceButton>
                        {createType === "shared" && selected ? (
                          <ChoiceButton
                            $selected={visible}
                            onPress={() =>
                              setCreateVisibleIds((ids) =>
                                visible
                                  ? ids.filter((id) => id !== instrument.id)
                                  : [...ids, instrument.id],
                              )
                            }
                          >
                            <ChoiceLabel $selected={visible}>
                              공동 공개
                            </ChoiceLabel>
                          </ChoiceButton>
                        ) : null}
                      </InlineRow>
                    </ItemCard>
                  )
                })}
            </Field>
          ) : null}
          <AppButton
            disabled={busy || !createName.trim()}
            label={busy ? "생성 중..." : "가계부 만들기"}
            tone="primary"
            onPress={() => void createLedger()}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>초대 코드로 참여</SectionTitle>
          <Field>
            <FieldLabel>초대 코드</FieldLabel>
            <Input
              accessibilityLabel="공동 가계부 초대 코드"
              autoCapitalize="characters"
              placeholder="초대 코드 입력"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
          </Field>
          <AppButton
            disabled={busy || !inviteCode.trim()}
            label="공동 가계부 참여"
            tone="primary"
            onPress={() => void store.acceptInvite(inviteCode)}
          />
        </SectionCard>

        {store.archivedOwnedLedgers.length > 0 ? (
          <SectionCard>
            <SectionTitle>보관된 가계부</SectionTitle>
            {store.archivedOwnedLedgers.map((archived) => (
              <ItemCard key={archived.id}>
                <ItemTitle>{archived.name}</ItemTitle>
                <ItemMeta>
                  {archived.purgeAfter
                    ? `${new Date(archived.purgeAfter).toLocaleDateString("ko-KR")} 이후 영구 삭제 예정`
                    : "복원 가능"}
                </ItemMeta>
                <TextButton
                  disabled={busy}
                  onPress={() => void store.restoreLedger(archived.id)}
                >
                  <TextButtonLabel>복원</TextButtonLabel>
                </TextButton>
              </ItemCard>
            ))}
          </SectionCard>
        ) : null}

        {ledger?.type === "shared" ? (
          <>
            <SectionCard>
              <SectionTitle>공동 멤버</SectionTitle>
              {store.currentMembers.map((member) => (
                <MemberManagementRow
                  key={member.id}
                  busy={busy}
                  canManage={ledger.role === "owner"}
                  isCurrentUser={member.userId === store.authUser?.id}
                  member={member}
                  onRemove={() =>
                    Alert.alert(
                      "멤버를 내보낼까요?",
                      `${member.nickname} 님의 접근 권한을 제거합니다.`,
                      [
                        { text: "취소", style: "cancel" },
                        {
                          text: "내보내기",
                          style: "destructive",
                          onPress: () => void store.removeMember(member.userId),
                        },
                      ],
                    )
                  }
                  onRoleChange={(role) =>
                    void store.updateMemberRole(member.userId, role)
                  }
                  onTransfer={() =>
                    Alert.alert(
                      "소유권을 이전할까요?",
                      `${member.nickname} 님이 새 소유자가 되고 내 역할은 관리자로 변경됩니다.`,
                      [
                        { text: "취소", style: "cancel" },
                        {
                          text: "이전",
                          style: "destructive",
                          onPress: () =>
                            void store.transferLedgerOwnership(member.userId),
                        },
                      ],
                    )
                  }
                />
              ))}
            </SectionCard>

            {canAdministerShared ? (
              <SectionCard>
                <SectionTitle>초대 관리</SectionTitle>
                <InlineRow>
                  {roleOptions.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      $selected={inviteRole === option.value}
                      onPress={() => setInviteRole(option.value)}
                    >
                      <ChoiceLabel $selected={inviteRole === option.value}>
                        {option.label}
                      </ChoiceLabel>
                    </ChoiceButton>
                  ))}
                </InlineRow>
                <AppButton
                  disabled={busy}
                  label="초대 코드 만들기"
                  tone="primary"
                  onPress={() => void createInvitation()}
                />
                {createdInviteCode ? (
                  <NoticeText selectable>
                    새 초대 코드: {createdInviteCode}
                  </NoticeText>
                ) : null}
                {activeInvitations.map((invitation) => (
                  <ItemCard key={invitation.id}>
                    <ItemTitle>
                      {invitation.inviteCode ?? "초대 코드"}
                    </ItemTitle>
                    <ItemMeta>
                      {roleLabel(invitation.roleToGrant)} ·{" "}
                      {new Date(invitation.expiresAt).toLocaleString("ko-KR")}{" "}
                      만료
                    </ItemMeta>
                    <TextButton
                      $danger
                      disabled={busy}
                      onPress={() => void store.revokeInvite(invitation.id)}
                    >
                      <TextButtonLabel $danger>초대 취소</TextButtonLabel>
                    </TextButton>
                  </ItemCard>
                ))}
              </SectionCard>
            ) : null}
          </>
        ) : null}
      </ManagementScaffold>
    )
  },
)

interface MemberManagementRowProps {
  busy: boolean
  canManage: boolean
  isCurrentUser: boolean
  member: LedgerMember
  onRemove: () => void
  onRoleChange: (role: GrantableRole) => void
  onTransfer: () => void
}

function MemberManagementRow({
  busy,
  canManage,
  isCurrentUser,
  member,
  onRemove,
  onRoleChange,
  onTransfer,
}: MemberManagementRowProps) {
  return (
    <ItemCard>
      <ItemTitle>
        {member.nickname}
        {isCurrentUser ? " · 나" : ""}
      </ItemTitle>
      <ItemMeta>{roleLabel(member.role)}</ItemMeta>
      {canManage && !isCurrentUser && member.role !== "owner" ? (
        <InlineRow>
          {roleOptions.map((option) => (
            <ChoiceButton
              key={option.value}
              $selected={member.role === option.value}
              disabled={busy}
              onPress={() => onRoleChange(option.value)}
            >
              <ChoiceLabel $selected={member.role === option.value}>
                {option.label}
              </ChoiceLabel>
            </ChoiceButton>
          ))}
          <TextButton disabled={busy} onPress={onTransfer}>
            <TextButtonLabel>소유권 이전</TextButtonLabel>
          </TextButton>
          <TextButton $danger disabled={busy} onPress={onRemove}>
            <TextButtonLabel $danger>내보내기</TextButtonLabel>
          </TextButton>
        </InlineRow>
      ) : null}
    </ItemCard>
  )
}

function roleLabel(role: LedgerRole): string {
  if (role === "owner") return "소유자"
  if (role === "admin") return "관리자"
  if (role === "viewer") return "조회자"
  return "멤버"
}
