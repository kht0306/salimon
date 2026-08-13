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
import { candidateStatusLabel, notificationAppName } from "./notificationInbox"

const safeAreaEdges = ["top"] as const

export const NotificationInboxScreen = observer(
  function NotificationInboxScreen() {
    const router = useRouter()
    const store = useMobileAppStore()
    const [selectedCandidate, setSelectedCandidate] =
      useState<LocalSmsCandidate>()

    useFocusEffect(
      useCallback(() => {
        void store.refreshNotificationInbox()
      }, [store]),
    )

    function confirmDeleteAll(): void {
      Alert.alert(
        "후보를 모두 삭제할까요?",
        "기기에 암호화 보관된 알림 원문과 등록 대기 정보도 함께 삭제되며 복구할 수 없습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "전체 삭제",
            style: "destructive",
            onPress: () => void store.deleteAllNotificationCandidates(),
          },
        ],
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
                {store.notificationCandidateCount > 0 ? (
                  <DeleteAllButton
                    accessibilityRole="button"
                    onPress={confirmDeleteAll}
                  >
                    <DeleteAllLabel>전체 삭제</DeleteAllLabel>
                  </DeleteAllButton>
                ) : null}
              </HeaderTop>
              <PrivacyNotice>
                원문과 등록 대기 정보는 기기에서만 최대 7일간 암호화 보관되며
                서버로 전송되지 않습니다.
              </PrivacyNotice>
              {store.notificationInboxErrorMessage ? (
                <ErrorNotice>{store.notificationInboxErrorMessage}</ErrorNotice>
              ) : null}
              {store.notificationInboxNoticeMessage ? (
                <InfoNotice>{store.notificationInboxNoticeMessage}</InfoNotice>
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
                  {store.notificationCaptureStatus.isCollectionEnabled
                    ? "확인할 후보가 없어요"
                    : "알림 후보함이 꺼져 있어요"}
                </EmptyTitle>
                <EmptyDescription>
                  {store.notificationCaptureStatus.isCollectionEnabled
                    ? "새 결제 알림이 감지되면 이곳에서 검토할 수 있습니다."
                    : "설정에서 개인정보 안내를 확인하고 지원 앱을 선택해 주세요."}
                </EmptyDescription>
                {!store.notificationCaptureStatus.isCollectionEnabled ? (
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
            return (
              <CandidateCard
                accessibilityLabel={`${item.parsed.merchantName ?? "가맹점 미확인"}, ${formatWon(item.parsed.amount)}, ${candidateStatusLabel(item)}`}
                accessibilityRole="button"
                onPress={() => setSelectedCandidate(item)}
              >
                <CardTop>
                  <SourceLabel>
                    {notificationAppName(item.sourceApp)}
                  </SourceLabel>
                  <StatusBadge $tone={statusTone}>
                    <StatusLabel $tone={statusTone}>
                      {candidateStatusLabel(item)}
                    </StatusLabel>
                  </StatusBadge>
                </CardTop>
                <Merchant numberOfLines={1}>
                  {item.parsed.merchantName ?? "가맹점 확인 필요"}
                </Merchant>
                <Amount>{formatWon(item.parsed.amount)}</Amount>
                <ReceivedAt>
                  {formatDateTime(item.parsed.transactionAt)}
                </ReceivedAt>
              </CandidateCard>
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

function formatWon(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount)
}

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
const DeleteAllButton = styled.Pressable({
  minHeight: 44,
  justifyContent: "center",
  paddingHorizontal: mobileTheme.spacing[2],
})
const DeleteAllLabel = styled.Text({
  color: mobileTheme.colors.coral,
  fontSize: 12,
  fontWeight: "800",
})
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
const CandidateCard = styled.Pressable({
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
})
const SourceLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
})
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
const ReceivedAt = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
})
