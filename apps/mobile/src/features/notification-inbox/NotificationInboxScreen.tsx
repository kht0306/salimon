import { useTheme } from "@emotion/react"
import styled from "@emotion/native"
import type { LocalSmsCandidate } from "@salimon/types"
import { useFocusEffect, useRouter } from "expo-router"
import { Check, Minus, Settings2 } from "lucide-react-native"
import { observer } from "mobx-react-lite"
import { useCallback, useState } from "react"
import { Alert, FlatList, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { CandidateEditor } from "./CandidateEditor"
import {
  candidateAmountLabel,
  candidateCardLabel,
  candidateStatusLabel,
  cardNotificationEventLabel,
  notificationAppName,
} from "./notificationInbox"

const safeAreaEdges = ["top"] as const
const candidateListContentStyle = {
  flexGrow: 1,
  gap: mobileTheme.spacing[3],
  paddingVertical: mobileTheme.spacing[5],
  paddingHorizontal: mobileTheme.spacing[4],
} as const

export const NotificationInboxScreen = observer(
  function NotificationInboxScreen() {
    const theme = useTheme()
    const router = useRouter()
    const store = useMobileAppStore()
    const [selectedCandidate, setSelectedCandidate] =
      useState<LocalSmsCandidate>()
    const [selectedCandidateIds, setSelectedCandidateIds] = useState<
      Set<string>
    >(() => new Set())
    const captureOperational =
      store.notificationCaptureStatus.isCollectionEnabled &&
      store.notificationCaptureStatus.hasNotificationAccess
    const selectedIds = store.notificationCandidates
      .map((candidate) => candidate.id)
      .filter((candidateId) => selectedCandidateIds.has(candidateId))
    const allSelected =
      store.notificationCandidateCount > 0 &&
      selectedIds.length === store.notificationCandidateCount

    useFocusEffect(
      useCallback(() => {
        void store.refreshNotificationInbox()
      }, [store]),
    )

    function toggleCandidateSelection(candidateId: string): void {
      setSelectedCandidateIds((currentIds) => {
        const nextIds = new Set(currentIds)
        if (nextIds.has(candidateId)) nextIds.delete(candidateId)
        else nextIds.add(candidateId)
        return nextIds
      })
    }

    function toggleAllCandidates(): void {
      setSelectedCandidateIds(
        allSelected
          ? new Set()
          : new Set(store.notificationCandidates.map(({ id }) => id)),
      )
    }

    function confirmDeleteSelection(): void {
      if (selectedIds.length === 0) return
      const deletingAll =
        selectedIds.length === store.notificationCandidateCount
      Alert.alert(
        deletingAll
          ? "후보를 모두 삭제할까요?"
          : `선택한 후보 ${selectedIds.length}건을 삭제할까요?`,
        "기기에 암호화 보관된 선택 후보의 알림 원문과 등록 대기 정보도 함께 삭제되며 복구할 수 없습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: deletingAll ? "전체 삭제" : "선택 삭제",
            style: "destructive",
            onPress: () => void deleteSelectedCandidates(selectedIds),
          },
        ],
      )
    }

    async function deleteSelectedCandidates(
      candidateIds: string[],
    ): Promise<void> {
      await store.deleteNotificationCandidates(candidateIds)
      const remainingIds = new Set(
        store.notificationCandidates.map((candidate) => candidate.id),
      )
      setSelectedCandidateIds(
        (currentIds) =>
          new Set(
            [...currentIds].filter((candidateId) =>
              remainingIds.has(candidateId),
            ),
          ),
      )
    }

    function confirmExclude(candidate: LocalSmsCandidate): void {
      Alert.alert(
        "이 후보를 제외할까요?",
        "기기에 암호화 보관된 해당 알림 원문과 등록 대기 정보도 함께 삭제됩니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "제외",
            style: "destructive",
            onPress: () => {
              setSelectedCandidate(undefined)
              void store.excludeNotificationCandidate(candidate.id)
            },
          },
        ],
      )
    }

    return (
      <Page edges={safeAreaEdges}>
        <CandidateList
          data={store.notificationCandidates}
          keyExtractor={(candidate) => candidate.id}
          refreshControl={
            <RefreshControl
              refreshing={store.notificationInboxStatus === "loading"}
              tintColor={theme.colors.teal}
              onRefresh={() => void store.refreshNotificationInbox()}
            />
          }
          contentContainerStyle={candidateListContentStyle}
          ListHeaderComponent={
            <Header>
              <HeaderTop>
                <HeaderCopy>
                  <Eyebrow>결제 알림</Eyebrow>
                  <Title accessibilityRole="header">후보함</Title>
                </HeaderCopy>
                <HeaderSettingsButton
                  accessibilityLabel="후보함 설정 열기"
                  accessibilityRole="button"
                  onPress={() => router.push("/(tabs)/settings")}
                >
                  <Settings2
                    color={theme.colors.muted}
                    size={19}
                    strokeWidth={1.8}
                  />
                </HeaderSettingsButton>
              </HeaderTop>
              {store.notificationCandidateCount > 0 ? (
                <SelectionToolbar>
                  <SelectAllButton
                    accessibilityLabel={
                      allSelected ? "후보 전체 선택 해제" : "후보 전체 선택"
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked:
                        selectedIds.length > 0 && !allSelected
                          ? "mixed"
                          : allSelected,
                    }}
                    onPress={toggleAllCandidates}
                  >
                    <CheckboxVisual $checked={selectedIds.length > 0}>
                      {allSelected ? (
                        <Check color={theme.colors.onAccent} size={16} />
                      ) : selectedIds.length > 0 ? (
                        <Minus color={theme.colors.onAccent} size={16} />
                      ) : null}
                    </CheckboxVisual>
                    <SelectAllLabel>전체 선택</SelectAllLabel>
                  </SelectAllButton>
                  <DeleteSelectionButton
                    accessibilityRole="button"
                    disabled={selectedIds.length === 0}
                    onPress={confirmDeleteSelection}
                  >
                    <DeleteSelectionLabel $disabled={selectedIds.length === 0}>
                      선택 삭제 ({selectedIds.length})
                    </DeleteSelectionLabel>
                  </DeleteSelectionButton>
                </SelectionToolbar>
              ) : null}
              <PrivacyNotice>
                원문과 등록 대기 정보는 기기에서만 최대 7일간 암호화 보관되며
                서버로 전송되지 않습니다.
              </PrivacyNotice>
              {store.notificationInboxErrorMessage ? (
                <ErrorNotice
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                >
                  {store.notificationInboxErrorMessage}
                </ErrorNotice>
              ) : null}
              {store.notificationInboxNoticeMessage ? (
                <InfoNotice accessibilityLiveRegion="polite">
                  {store.notificationInboxNoticeMessage}
                </InfoNotice>
              ) : null}
            </Header>
          }
          ListEmptyComponent={
            store.notificationInboxStatus === "loading" ? (
              <LoadingCards>
                <SkeletonCard />
                <SkeletonCard />
              </LoadingCards>
            ) : (
              <EmptyCard>
                <EmptyTitle>
                  {captureOperational
                    ? "확인할 후보가 없어요"
                    : store.notificationCaptureStatus.isCollectionEnabled
                      ? "알림 접근이 꺼져 있어요"
                      : "알림 후보함이 꺼져 있어요"}
                </EmptyTitle>
                <EmptyDescription>
                  {captureOperational
                    ? "새 결제 알림이 감지되면 이곳에서 검토할 수 있습니다."
                    : store.notificationCaptureStatus.isCollectionEnabled
                      ? "설정에서 Android 알림 접근을 다시 허용해 주세요. 보관 중인 후보는 삭제되지 않습니다."
                      : "설정에서 개인정보 안내를 확인하고 지원 앱을 선택해 주세요."}
                </EmptyDescription>
                {!captureOperational ? (
                  <AppButton
                    label="알림 후보함 설정"
                    tone="primary"
                    onPress={() => router.push("/(tabs)/settings")}
                  />
                ) : null}
              </EmptyCard>
            )
          }
          renderItem={({ item }) => {
            const statusTone = candidateStatusTone(item)
            const eventLabel = cardNotificationEventLabel(item)
            const selected = selectedCandidateIds.has(item.id)
            const amountLabel = candidateAmountLabel(item)
            const cancellation =
              item.parsed.cardNotificationEvent === "approval_cancellation"
            const candidateActionLabel = cancellation
              ? "상세 확인"
              : "내용 확인 후 등록"
            return (
              <CandidateRow>
                <CandidateCheckbox
                  accessibilityLabel={`${item.parsed.merchantName ?? "가맹점 미확인"} 후보 선택`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleCandidateSelection(item.id)}
                >
                  <CandidateCheckboxVisual $checked={selected}>
                    {selected ? (
                      <Check
                        color={theme.colors.onAccent}
                        size={16}
                        strokeWidth={2.2}
                      />
                    ) : null}
                  </CandidateCheckboxVisual>
                </CandidateCheckbox>
                <CandidateCard>
                  <CandidateOpenButton
                    accessibilityLabel={`${item.parsed.merchantName ?? "가맹점 미확인"}, ${amountLabel}, ${eventLabel ?? "거래 알림"}, ${candidateStatusLabel(item)}`}
                    accessibilityRole="button"
                    onPress={() => setSelectedCandidate(item)}
                  >
                    <CardTop>
                      <SourceLabel>{candidateCardLabel(item)}</SourceLabel>
                      <BadgeGroup>
                        {eventLabel ? (
                          <EventBadge $cancelled={cancellation}>
                            <EventLabel $cancelled={cancellation}>
                              {eventLabel}
                            </EventLabel>
                          </EventBadge>
                        ) : null}
                        <StatusBadge $tone={statusTone}>
                          <StatusLabel $tone={statusTone}>
                            {candidateStatusLabel(item)}
                          </StatusLabel>
                        </StatusBadge>
                      </BadgeGroup>
                    </CardTop>
                    <Merchant numberOfLines={1}>
                      {item.parsed.merchantName ?? "가맹점 확인 필요"}
                    </Merchant>
                    <Amount>{amountLabel}</Amount>
                    {item.parsed.originalCurrencyAmount ? (
                      <ForeignAmountHint>
                        원화 반영금액을 입력해 주세요.
                      </ForeignAmountHint>
                    ) : null}
                    <ReceivedAt>
                      {notificationAppName(item.sourceApp)} ·{" "}
                      {formatDateTime(item.parsed.transactionAt)}
                    </ReceivedAt>
                  </CandidateOpenButton>
                  <CandidateAction
                    $primary={!cancellation}
                    accessibilityRole="button"
                    onPress={() => setSelectedCandidate(item)}
                  >
                    <CandidateActionLabel $primary={!cancellation}>
                      {candidateActionLabel}
                    </CandidateActionLabel>
                  </CandidateAction>
                </CandidateCard>
              </CandidateRow>
            )
          }}
        />

        {selectedCandidate ? (
          <CandidateEditor
            key={selectedCandidate.id}
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(undefined)}
            onDefer={() => {
              store.deferNotificationCandidate(selectedCandidate.id)
              setSelectedCandidate(undefined)
            }}
            onExclude={() => confirmExclude(selectedCandidate)}
          />
        ) : null}
      </Page>
    )
  },
)

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

type CandidateStatusTone = "pending" | "ready" | "review"

function candidateStatusTone(
  candidate: LocalSmsCandidate,
): CandidateStatusTone {
  if (candidate.status === "registration_pending") return "pending"
  return candidate.status === "needs_review" ? "review" : "ready"
}

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }: { theme: typeof mobileTheme }) =>
    theme.colors.canvas};
`
const CandidateList = styled(FlatList<LocalSmsCandidate>)({ flex: 1 })
const Header = styled.View({ gap: mobileTheme.spacing[3] })
const HeaderTop = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})
const HeaderCopy = styled.View({ gap: mobileTheme.spacing[1] })
const Eyebrow = styled(AppText)(({ theme }) => ({
  color: theme.colors.teal,
  fontSize: 12,
  fontWeight: "600",
}))
const Title = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  ...mobileTheme.typography.title,
}))
const HeaderSettingsButton = styled.Pressable(({ theme }) => ({
  width: mobileTheme.controls.touch,
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: theme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: theme.colors.panel,
}))
const SelectionToolbar = styled.View({
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})
const SelectAllButton = styled.Pressable({
  minHeight: 44,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})
const CheckboxVisual = styled.View<{ $checked: boolean }>(
  ({ theme, $checked }) => ({
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: $checked ? theme.colors.teal : theme.colors.borderStrong,
    borderRadius: mobileTheme.radii.xs,
    backgroundColor: $checked ? theme.colors.teal : theme.colors.panel,
  }),
)
const SelectAllLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 13,
  fontWeight: "600",
}))
const DeleteSelectionButton = styled.Pressable(({ disabled }) => ({
  minHeight: 44,
  justifyContent: "center",
  paddingHorizontal: mobileTheme.spacing[2],
  opacity: disabled ? 0.55 : 1,
}))
const DeleteSelectionLabel = styled(AppText)<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    color: $disabled ? theme.colors.muted : theme.colors.coral,
    fontSize: 12,
    fontWeight: "600",
  }),
)
const PrivacyNotice = styled(AppText)(({ theme }) => ({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.tealSoft,
  color: theme.colors.teal,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
}))
const ErrorNotice = styled(AppText)(({ theme }) => ({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.coralSoft,
  color: theme.colors.coral,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
}))
const InfoNotice = styled(AppText)(({ theme }) => ({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.amberSoft,
  color: theme.colors.amber,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
}))
const LoadingCards = styled.View({ gap: mobileTheme.spacing[3] })
const SkeletonCard = styled.View(({ theme }) => ({
  height: 152,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.border,
  opacity: 0.55,
}))
const EmptyCard = styled.View(({ theme }) => ({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.panel,
  padding: mobileTheme.spacing[5],
}))
const EmptyTitle = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 18,
  fontWeight: "600",
}))
const EmptyDescription = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 13,
  lineHeight: 20,
}))
const CandidateRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: mobileTheme.spacing[3],
})
const CandidateCheckbox = styled.Pressable({
  width: mobileTheme.controls.touch,
  height: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  marginTop: mobileTheme.spacing[2],
})
const CandidateCheckboxVisual = styled.View<{ $checked: boolean }>(
  ({ theme, $checked }) => ({
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: $checked ? theme.colors.teal : theme.colors.borderStrong,
    borderRadius: mobileTheme.radii.xs,
    backgroundColor: $checked ? theme.colors.teal : theme.colors.panel,
  }),
)
const CandidateCard = styled.View(({ theme }) => ({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.panel,
  padding: mobileTheme.spacing[4],
}))
const CandidateOpenButton = styled.Pressable({
  gap: mobileTheme.spacing[2],
})
const CardTop = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
})
const SourceLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
}))
const BadgeGroup = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[1],
})
const EventBadge = styled.View<{ $cancelled: boolean }>(
  ({ theme, $cancelled }) => ({
    borderRadius: mobileTheme.radii.round,
    backgroundColor: $cancelled
      ? theme.colors.coralSoft
      : theme.colors.panelSubtle,
    paddingVertical: mobileTheme.spacing[1],
    paddingHorizontal: mobileTheme.spacing[2],
  }),
)
const EventLabel = styled(AppText)<{ $cancelled: boolean }>(
  ({ theme, $cancelled }) => ({
    color: $cancelled ? theme.colors.coral : theme.colors.muted,
    fontSize: 10,
    fontWeight: "600",
  }),
)
const StatusBadge = styled.View<{ $tone: CandidateStatusTone }>(
  ({ theme, $tone }) => ({
    borderRadius: mobileTheme.radii.round,
    backgroundColor:
      $tone === "ready" ? theme.colors.tealSoft : theme.colors.amberSoft,
    paddingVertical: mobileTheme.spacing[1],
    paddingHorizontal: mobileTheme.spacing[2],
  }),
)
const StatusLabel = styled(AppText)<{ $tone: CandidateStatusTone }>(
  ({ theme, $tone }) => ({
    color: $tone === "ready" ? theme.colors.teal : theme.colors.amber,
    fontSize: 10,
    fontWeight: "600",
  }),
)
const Merchant = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 16,
  fontWeight: "600",
}))
const Amount = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 24,
  fontWeight: "700",
}))
const ForeignAmountHint = styled(AppText)(({ theme }) => ({
  color: theme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
}))
const ReceivedAt = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 11,
}))
const CandidateAction = styled.Pressable<{ $primary: boolean }>(
  ({ theme, $primary }) => ({
    minHeight: mobileTheme.controls.touch,
    alignItems: "center",
    justifyContent: "center",
    marginTop: mobileTheme.spacing[1],
    borderWidth: 1,
    borderColor: $primary ? theme.colors.teal : theme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: $primary
      ? theme.colors.tealSoft
      : theme.colors.panelSubtle,
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)
const CandidateActionLabel = styled(AppText)<{ $primary: boolean }>(
  ({ theme, $primary }) => ({
    color: $primary ? theme.colors.teal : theme.colors.ink,
    ...mobileTheme.typography.label,
  }),
)
