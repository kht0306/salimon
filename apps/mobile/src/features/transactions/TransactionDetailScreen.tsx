import styled from "@emotion/native"
import { formatKrw, getCategoryLabel } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { observer } from "mobx-react-lite"
import { Alert, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import {
  transactionCategoryLabel,
  transactionMemberLabel,
  transactionPaymentLabel,
  transactionSourceLabel,
  transactionStatusLabel,
  transactionStructureLabels,
  transactionTypeLabel,
} from "./transactionPresentation"
import { isGeneralMobileTransaction } from "./transactionDraft"

const safeAreaEdges = ["top", "bottom"] as const
const scrollContentStyle = { paddingBottom: 32 } as const

export const TransactionDetailScreen = observer(
  function TransactionDetailScreen() {
    const store = useMobileAppStore()
    const { id } = useLocalSearchParams<{ id: string }>()

    if (store.authState === "anonymous") {
      return <Redirect href="/auth/login" />
    }
    if (store.authState !== "authenticated") {
      return <DetailState message="로그인 상태를 확인하고 있어요." />
    }
    if (store.requiresLegalConsent) {
      return <Redirect href="/consent" />
    }
    if (store.dataStatus === "idle" || store.dataStatus === "loading") {
      return <DetailState message="거래 정보를 불러오고 있어요." />
    }
    if (store.dataStatus === "error") {
      return (
        <DetailState
          actionLabel="다시 불러오기"
          message={store.dataErrorMessage ?? "거래 정보를 불러오지 못했습니다."}
          onAction={() => void store.refreshSelectedMonth()}
        />
      )
    }

    const transaction = store.financeData.transactions.find(
      (item) => item.id === id,
    )
    if (!transaction) {
      return (
        <DetailState
          actionLabel="거래 목록으로 돌아가기"
          message="현재 불러온 월에서 거래를 찾지 못했습니다."
          onAction={() => router.replace("/transactions")}
        />
      )
    }

    const categories = store.financeData.categories.filter(
      (category) => category.ledgerId === transaction.ledgerId,
    )
    const members = store.financeData.members.filter(
      (member) => member.ledgerId === transaction.ledgerId,
    )
    const paymentMethod = store.financeData.paymentMethods.find(
      (method) => method.id === transaction.paymentMethodId,
    )
    const splits = store.financeData.transactionSplits
      .filter((split) => split.transactionId === transaction.id)
      .sort((first, second) => first.sortOrder - second.sortOrder)
    const structureLabel = transactionStructureLabels(
      transaction,
      splits.length,
    ).join(" · ")
    const isGeneralTransaction = isGeneralMobileTransaction(
      transaction,
      splits.length,
    )
    const canMutate =
      store.canMutateCurrentLedger &&
      transaction.ledgerId === store.selectedLedgerId &&
      isGeneralTransaction
    const paymentLabel = transactionPaymentLabel(transaction, paymentMethod)
    const title =
      transaction.merchantName ??
      transaction.memo ??
      transactionCategoryLabel(transaction, categories)

    return (
      <Page edges={safeAreaEdges}>
        <ScrollView contentContainerStyle={scrollContentStyle}>
          <Content>
            <TopBar>
              <BackButton
                accessibilityLabel="거래 목록으로 돌아가기"
                accessibilityRole="button"
                onPress={() => router.back()}
              >
                <BackLabel>뒤로</BackLabel>
              </BackButton>
              <ScreenLabel>거래 상세</ScreenLabel>
              <TopBarSpacer />
            </TopBar>

            <AmountCard $type={transaction.type}>
              <TypeLabel $type={transaction.type}>
                {transactionTypeLabel(transaction.type)}
                {transaction.status === "excluded" ? " · 합계 제외" : ""}
              </TypeLabel>
              <Amount>{formatKrw(transaction.amount)}</Amount>
              <TransactionTitle>{title}</TransactionTitle>
              <TransactionDate>
                {formatTransactionDateTime(transaction.transactionAt)}
              </TransactionDate>
            </AmountCard>

            {canMutate ? (
              <ActionRow>
                <EditButton
                  accessibilityRole="button"
                  disabled={store.transactionMutationState !== "idle"}
                  onPress={() =>
                    router.push({
                      pathname: "/transactions/[id]/edit",
                      params: { id: transaction.id },
                    })
                  }
                >
                  <EditButtonLabel>수정</EditButtonLabel>
                </EditButton>
                <DeleteButton
                  accessibilityRole="button"
                  disabled={store.transactionMutationState !== "idle"}
                  onPress={() => confirmDelete(transaction.id)}
                >
                  <DeleteButtonLabel>
                    {store.transactionMutationState === "deleting"
                      ? "삭제 중..."
                      : "삭제"}
                  </DeleteButtonLabel>
                </DeleteButton>
              </ActionRow>
            ) : null}

            {store.transactionMutationErrorMessage ? (
              <MutationError accessibilityLiveRegion="assertive">
                {store.transactionMutationErrorMessage}
              </MutationError>
            ) : null}

            {structureLabel ? (
              <ReadOnlyNotice>
                <ReadOnlyTitle>{structureLabel}</ReadOnlyTitle>
                <ReadOnlyDescription>
                  고정·할부·분할 거래는 모바일에서 안전하게 조회만 할 수
                  있습니다. 변경은 웹에서 관리해 주세요.
                </ReadOnlyDescription>
                <WebManageButton
                  accessibilityRole="button"
                  onPress={() => void openWebTransactions()}
                >
                  <WebManageButtonLabel>웹에서 관리</WebManageButtonLabel>
                </WebManageButton>
              </ReadOnlyNotice>
            ) : null}

            <Section>
              <SectionTitle>거래 정보</SectionTitle>
              <DetailRow
                label="상태"
                value={transactionStatusLabel(transaction.status)}
              />
              <DetailRow
                label="거래자"
                value={transactionMemberLabel(
                  transaction.actorUserId,
                  members,
                  "공통",
                )}
              />
              <DetailRow
                label="등록자"
                value={transactionMemberLabel(
                  transaction.createdBy,
                  members,
                  "탈퇴한 멤버 또는 알 수 없음",
                )}
              />
              <DetailRow
                label="카테고리"
                value={transactionCategoryLabel(transaction, categories)}
              />
              {paymentLabel ? (
                <DetailRow label="결제수단" value={paymentLabel} />
              ) : null}
              {transaction.incomeKind ? (
                <DetailRow
                  label="수입 종류"
                  value={
                    transaction.incomeKind === "salary" ? "급여" : "부수입"
                  }
                />
              ) : null}
              <DetailRow
                label="기록 방식"
                value={transactionSourceLabel(transaction.sourceType)}
              />
            </Section>

            {transaction.merchantName || transaction.memo ? (
              <Section>
                <SectionTitle>내용</SectionTitle>
                {transaction.merchantName ? (
                  <LongDetail label="가맹점" value={transaction.merchantName} />
                ) : null}
                {transaction.memo ? (
                  <LongDetail label="메모" value={transaction.memo} />
                ) : null}
              </Section>
            ) : null}

            {splits.length > 0 ? (
              <Section>
                <SectionHeading>
                  <SectionTitle>분할 카테고리</SectionTitle>
                  <SectionCount>{splits.length}개</SectionCount>
                </SectionHeading>
                {splits.map((split) => {
                  const category = categories.find(
                    (item) => item.id === split.categoryId,
                  )
                  return (
                    <SplitRow key={split.id}>
                      <SplitMarker
                        style={{
                          backgroundColor:
                            category?.color ?? mobileTheme.colors.subtle,
                        }}
                      />
                      <SplitName>
                        {getCategoryLabel(
                          categories,
                          split.categoryId,
                          "삭제된 카테고리",
                        )}
                        {category?.isArchived ? " · 보관됨" : ""}
                      </SplitName>
                      <SplitAmount>{formatKrw(split.amount)}</SplitAmount>
                    </SplitRow>
                  )
                })}
              </Section>
            ) : null}

            {(transaction.tags?.length ?? 0) > 0 ? (
              <Section>
                <SectionTitle>태그</SectionTitle>
                <TagList>
                  {transaction.tags?.map((tag) => (
                    <Tag key={tag}>#{tag}</Tag>
                  ))}
                </TagList>
              </Section>
            ) : null}

            <Section>
              <SectionTitle>기록 정보</SectionTitle>
              <DetailRow
                label="등록 시각"
                value={formatTransactionDateTime(transaction.createdAt)}
              />
              <DetailRow
                label="마지막 변경"
                value={formatTransactionDateTime(transaction.updatedAt)}
              />
              <DetailRow label="거래 ID" value={transaction.id} subdued />
            </Section>
          </Content>
        </ScrollView>
      </Page>
    )

    function confirmDelete(transactionId: string): void {
      Alert.alert(
        "거래를 삭제할까요?",
        "삭제한 일반 거래는 월 합계와 목록에서 제외됩니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => void deleteTransaction(transactionId),
          },
        ],
      )
    }

    async function deleteTransaction(transactionId: string): Promise<void> {
      const deleted = await store.deleteGeneralTransaction(transactionId)
      if (deleted) router.replace("/transactions")
    }
  },
)

async function openWebTransactions(): Promise<void> {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "")
  if (!webUrl) {
    Alert.alert("웹 주소 확인 필요", "모바일 웹 주소가 설정되지 않았습니다.")
    return
  }

  try {
    await WebBrowser.openBrowserAsync(`${webUrl}/transactions`)
  } catch {
    Alert.alert("웹을 열 수 없음", "잠시 후 다시 시도해 주세요.")
  }
}

interface DetailRowProps {
  label: string
  subdued?: boolean
  value: string
}

function DetailRow({ label, subdued = false, value }: DetailRowProps) {
  return (
    <DetailRowContainer>
      <DetailLabel>{label}</DetailLabel>
      <DetailValue $subdued={subdued}>{value}</DetailValue>
    </DetailRowContainer>
  )
}

function LongDetail({ label, value }: DetailRowProps) {
  return (
    <LongDetailContainer>
      <DetailLabel>{label}</DetailLabel>
      <LongDetailValue>{value}</LongDetailValue>
    </LongDetailContainer>
  )
}

interface DetailStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function DetailState({ actionLabel, message, onAction }: DetailStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateMessage accessibilityLiveRegion="polite">{message}</StateMessage>
        {actionLabel && onAction ? (
          <StateButton accessibilityRole="button" onPress={onAction}>
            <StateButtonLabel>{actionLabel}</StateButtonLabel>
          </StateButton>
        ) : null}
      </StateContent>
    </Page>
  )
}

function formatTransactionDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value))
}

function typeSoftColor(type: Transaction["type"]): string {
  if (type === "income") return mobileTheme.colors.greenSoft
  if (type === "saving") return mobileTheme.colors.tealSoft
  return mobileTheme.colors.panel
}

function typeColor(type: Transaction["type"]): string {
  if (type === "income") return mobileTheme.colors.green
  if (type === "saving") return mobileTheme.colors.teal
  return mobileTheme.colors.border
}

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
})

const Content = styled.View({
  width: "100%",
  maxWidth: 720,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const TopBar = styled.View({
  minHeight: 44,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const BackButton = styled.Pressable({
  minWidth: 56,
  minHeight: 40,
  justifyContent: "center",
})

const BackLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "600",
})

const ScreenLabel = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 15,
  fontWeight: "600",
})

const TopBarSpacer = styled.View({ width: 56 })

const AmountCard = styled.View<{ $type: Transaction["type"] }>(({ $type }) => ({
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: typeColor($type),
  borderRadius: mobileTheme.radii.md,
  backgroundColor: typeSoftColor($type),
  padding: mobileTheme.spacing[5],
}))

const TypeLabel = styled(AppText)<{ $type: Transaction["type"] }>(
  ({ $type }) => ({
    color: typeColor($type),
    fontSize: 11,
    fontWeight: "600",
  }),
)

const Amount = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 30,
  fontWeight: "700",
  letterSpacing: -0.8,
  lineHeight: 39,
})

const TransactionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 16,
  fontWeight: "600",
  lineHeight: 23,
})

const TransactionDate = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

const ReadOnlyNotice = styled.View({
  gap: mobileTheme.spacing[1],
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const ReadOnlyTitle = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 12,
  fontWeight: "600",
})

const ReadOnlyDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

const WebManageButton = styled.Pressable({
  minHeight: 40,
  alignSelf: "flex-start",
  justifyContent: "center",
  marginTop: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: mobileTheme.colors.teal,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[3],
})

const WebManageButtonLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
})

const ActionRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
})

const EditButton = styled.Pressable(({ disabled }) => ({
  minHeight: 46,
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.teal,
  opacity: disabled ? 0.45 : 1,
}))

const EditButtonLabel = styled(AppText)({
  color: mobileTheme.colors.panel,
  fontSize: 13,
  fontWeight: "600",
})

const DeleteButton = styled.Pressable(({ disabled }) => ({
  minHeight: 46,
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: mobileTheme.colors.coral,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  opacity: disabled ? 0.45 : 1,
}))

const DeleteButtonLabel = styled(AppText)({
  color: mobileTheme.colors.coral,
  fontSize: 13,
  fontWeight: "600",
})

const MutationError = styled(AppText)({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 11,
  fontWeight: "700",
  lineHeight: 17,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const Section = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const SectionHeading = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
})

const SectionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "600",
})

const SectionCount = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "600",
})

const DetailRowContainer = styled.View({
  minHeight: 30,
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[4],
})

const DetailLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 18,
})

const DetailValue = styled(AppText)<{ $subdued: boolean }>(({ $subdued }) => ({
  minWidth: 0,
  flex: 1,
  color: $subdued ? mobileTheme.colors.subtle : mobileTheme.colors.ink,
  fontSize: $subdued ? 9 : 11,
  fontWeight: $subdued ? "400" : "600",
  lineHeight: 18,
  textAlign: "right",
}))

const LongDetailContainer = styled.View({ gap: mobileTheme.spacing[1] })

const LongDetailValue = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 13,
  lineHeight: 20,
})

const SplitRow = styled.View({
  minHeight: 32,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const SplitMarker = styled.View({
  width: 7,
  height: 7,
  borderRadius: mobileTheme.radii.round,
})

const SplitName = styled(AppText)({
  minWidth: 0,
  flex: 1,
  color: mobileTheme.colors.ink,
  fontSize: 11,
  fontWeight: "600",
})

const SplitAmount = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
})

const TagList = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[2],
})

const Tag = styled(AppText)({
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.tealSoft,
  color: mobileTheme.colors.teal,
  fontSize: 10,
  fontWeight: "700",
  paddingVertical: mobileTheme.spacing[1],
  paddingHorizontal: mobileTheme.spacing[2],
})

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[5],
})

const StateMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})

const StateButton = styled.Pressable({
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.teal,
  paddingHorizontal: mobileTheme.spacing[4],
})

const StateButtonLabel = styled(AppText)({
  color: mobileTheme.colors.panel,
  fontSize: 13,
  fontWeight: "600",
})
