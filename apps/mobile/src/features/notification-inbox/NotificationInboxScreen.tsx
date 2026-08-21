import styled from "@emotion/native"
import type { LocalSmsCandidate } from "@salimon/types"
import { useFocusEffect, useRouter } from "expo-router"
import { observer } from "mobx-react-lite"
import { useCallback, useState } from "react"
import { Alert, FlatList, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { CandidateEditor } from "./CandidateEditor"
import {
  candidateAmountLabel,
  candidateStatusLabel,
  cardNotificationEventLabel,
  notificationAppName,
} from "./notificationInbox"

const safeAreaEdges = ["top"] as const

export const NotificationInboxScreen = observer(
  function NotificationInboxScreen() {
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
              tintColor={mobileTheme.colors.teal}
              onRefresh={() => void store.refreshNotificationInbox()}
            />
          }
          contentContainerStyle={{
            flexGrow: 1,
            gap: mobileTheme.spacing[3],
            padding: mobileTheme.spacing[5],
          }}
          ListHeaderComponent={
            <Header>
              <HeaderTop>
                <HeaderCopy>
                  <Eyebrow>결제 알림</Eyebrow>
                  <Title accessibilityRole="header">후보함</Title>
                </HeaderCopy>
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
                      <CheckboxMark>
                        {allSelected ? "✓" : selectedIds.length > 0 ? "−" : ""}
                      </CheckboxMark>
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
            return (
              <CandidateRow>
                <CandidateCheckbox
                  accessibilityLabel={`${item.parsed.merchantName ?? "가맹점 미확인"} 후보 선택`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  $checked={selected}
                  onPress={() => toggleCandidateSelection(item.id)}
                >
                  <CheckboxMark>{selected ? "✓" : ""}</CheckboxMark>
                </CandidateCheckbox>
                <CandidateCard
                  accessibilityLabel={`${item.parsed.merchantName ?? "가맹점 미확인"}, ${candidateAmountLabel(item)}, ${eventLabel ?? "거래 알림"}, ${candidateStatusLabel(item)}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedCandidate(item)}
                >
                  <CardTop>
                    <SourceLabel>
                      {notificationAppName(item.sourceApp)}
                    </SourceLabel>
                    <BadgeGroup>
                      {eventLabel ? (
                        <EventBadge
                          $cancelled={
                            item.parsed.cardNotificationEvent ===
                            "approval_cancellation"
                          }
                        >
                          <EventLabel
                            $cancelled={
                              item.parsed.cardNotificationEvent ===
                              "approval_cancellation"
                            }
                          >
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
                  <Amount>{candidateAmountLabel(item)}</Amount>
                  {item.parsed.originalCurrencyAmount ? (
                    <ForeignAmountHint>
                      원화 반영금액을 입력해 주세요.
                    </ForeignAmountHint>
                  ) : null}
                  <ReceivedAt>
                    {formatDateTime(item.parsed.transactionAt)}
                  </ReceivedAt>
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
  background-color: ${mobileTheme.colors.canvas};
`
const CandidateList = styled(FlatList<LocalSmsCandidate>)({ flex: 1 })
const Header = styled.View({ gap: mobileTheme.spacing[3] })
const HeaderTop = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})
const HeaderCopy = styled.View({ gap: mobileTheme.spacing[1] })
const Eyebrow = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 12,
  fontWeight: "800",
})
const Title = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 26,
  fontWeight: "900",
})
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
const CheckboxVisual = styled.View<{ $checked: boolean }>(({ $checked }) => ({
  width: 24,
  height: 24,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.xs,
  backgroundColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.panel,
}))
const CheckboxMark = styled.Text({
  color: mobileTheme.colors.panel,
  fontSize: 16,
  fontWeight: "900",
  lineHeight: 18,
})
const SelectAllLabel = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 13,
  fontWeight: "800",
})
const DeleteSelectionButton = styled.Pressable(({ disabled }) => ({
  minHeight: 44,
  justifyContent: "center",
  paddingHorizontal: mobileTheme.spacing[2],
  opacity: disabled ? 0.55 : 1,
}))
const DeleteSelectionLabel = styled.Text<{ $disabled: boolean }>(
  ({ $disabled }) => ({
    color: $disabled ? mobileTheme.colors.muted : mobileTheme.colors.coral,
    fontSize: 12,
    fontWeight: "800",
  }),
)
const PrivacyNotice = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.tealSoft,
  color: mobileTheme.colors.teal,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
})
const ErrorNotice = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
})
const InfoNotice = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.amberSoft,
  color: mobileTheme.colors.amber,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
})
const LoadingCards = styled.View({ gap: mobileTheme.spacing[3] })
const SkeletonCard = styled.View({
  height: 152,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.border,
  opacity: 0.55,
})
const EmptyCard = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[5],
})
const EmptyTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 18,
  fontWeight: "900",
})
const EmptyDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 13,
  lineHeight: 20,
})
const CandidateRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: mobileTheme.spacing[3],
})
const CandidateCheckbox = styled.Pressable<{ $checked: boolean }>(
  ({ $checked }) => ({
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: mobileTheme.spacing[4],
    borderWidth: 2,
    borderColor: $checked
      ? mobileTheme.colors.teal
      : mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.xs,
    backgroundColor: $checked
      ? mobileTheme.colors.teal
      : mobileTheme.colors.panel,
  }),
)
const CandidateCard = styled.Pressable({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})
const CardTop = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
})
const SourceLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
})
const BadgeGroup = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[1],
})
const EventBadge = styled.View<{ $cancelled: boolean }>(({ $cancelled }) => ({
  borderRadius: mobileTheme.radii.round,
  backgroundColor: $cancelled
    ? mobileTheme.colors.coralSoft
    : mobileTheme.colors.blueSoft,
  paddingVertical: mobileTheme.spacing[1],
  paddingHorizontal: mobileTheme.spacing[2],
}))
const EventLabel = styled.Text<{ $cancelled: boolean }>(({ $cancelled }) => ({
  color: $cancelled ? mobileTheme.colors.coral : mobileTheme.colors.blue,
  fontSize: 10,
  fontWeight: "800",
}))
const StatusBadge = styled.View<{ $tone: CandidateStatusTone }>(
  ({ $tone }) => ({
    borderRadius: mobileTheme.radii.round,
    backgroundColor:
      $tone === "ready"
        ? mobileTheme.colors.tealSoft
        : mobileTheme.colors.amberSoft,
    paddingVertical: mobileTheme.spacing[1],
    paddingHorizontal: mobileTheme.spacing[2],
  }),
)
const StatusLabel = styled.Text<{ $tone: CandidateStatusTone }>(
  ({ $tone }) => ({
    color:
      $tone === "ready" ? mobileTheme.colors.teal : mobileTheme.colors.amber,
    fontSize: 10,
    fontWeight: "800",
  }),
)
const Merchant = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 16,
  fontWeight: "800",
})
const Amount = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 24,
  fontWeight: "900",
})
const ForeignAmountHint = styled.Text({
  color: mobileTheme.colors.blue,
  fontSize: 11,
  fontWeight: "700",
})
const ReceivedAt = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
})
