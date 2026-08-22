import styled from "@emotion/native"
import { Redirect, router } from "expo-router"
import { observer } from "mobx-react-lite"
import type { ReactNode } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

interface ManagementScaffoldProps {
  children: ReactNode
  description: string
  title: string
}

const safeAreaEdges = ["top", "bottom"] as const

export const ManagementScaffold = observer(function ManagementScaffold({
  children,
  description,
  title,
}: ManagementScaffoldProps) {
  const store = useMobileAppStore()
  if (store.authState === "anonymous") return <Redirect href="/auth/login" />
  if (store.authState !== "authenticated") {
    return <ManagementState message="로그인 상태를 확인하고 있어요." />
  }
  if (store.requiresLegalConsent) return <Redirect href="/consent" />
  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return <ManagementState message="관리 정보를 불러오고 있어요." />
  }
  if (store.dataStatus === "error") {
    return (
      <ManagementState
        actionLabel="다시 불러오기"
        message={store.dataErrorMessage ?? "관리 정보를 불러오지 못했습니다."}
        onAction={() => void store.refreshSelectedMonth()}
      />
    )
  }

  return (
    <Page edges={safeAreaEdges}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TopBar>
          <BackButton
            accessibilityLabel={`${title} 닫기`}
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <BackLabel>뒤로</BackLabel>
          </BackButton>
          <TopTitle>{title}</TopTitle>
          <TopSpacer />
        </TopBar>
        <Intro>
          <Title accessibilityRole="header">{title}</Title>
          <Description>{description}</Description>
        </Intro>
        {store.dataStatus === "stale" ? (
          <ErrorText accessibilityLiveRegion="polite">
            최신 정보를 불러오지 못해 마지막 조회 내용을 읽기 전용으로
            표시합니다.
          </ErrorText>
        ) : null}
        {children}
      </ScrollView>
    </Page>
  )
})

interface ManagementStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function ManagementState({
  actionLabel,
  message,
  onAction,
}: ManagementStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateMessage accessibilityLiveRegion="polite">{message}</StateMessage>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} tone="primary" onPress={onAction} />
        ) : null}
      </StateContent>
    </Page>
  )
}

export const SectionCard = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

export const SectionHeading = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

export const SectionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 15,
  fontWeight: "700",
})

export const SectionDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

export const Field = styled.View({ gap: mobileTheme.spacing[1] })

export const FieldLabel = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
})

export const Input = styled.TextInput({
  minHeight: 44,
  borderWidth: 1,
  borderColor: mobileTheme.colors.borderStrong,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.ink,
  paddingHorizontal: mobileTheme.spacing[3],
  fontFamily: "Pretendard",
  fontSize: 14,
})

export const InlineRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[2],
})

export const ChoiceButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.borderStrong,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)

export const ChoiceLabel = styled(AppText)<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  }),
)

export const ItemCard = styled.View({
  gap: mobileTheme.spacing[2],
  borderTopWidth: 1,
  borderTopColor: mobileTheme.colors.border,
  paddingTop: mobileTheme.spacing[3],
})

export const ItemTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "700",
})

export const ItemMeta = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

export const TextButton = styled.Pressable<{ $danger?: boolean }>(
  ({ $danger = false, disabled }) => ({
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: $danger
      ? mobileTheme.colors.coral
      : mobileTheme.colors.borderStrong,
    opacity: disabled ? 0.45 : 1,
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)

export const TextButtonLabel = styled(AppText)<{ $danger?: boolean }>(
  ({ $danger = false }) => ({
    color: $danger ? mobileTheme.colors.coral : mobileTheme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  }),
)

export const ErrorText = styled(AppText)({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  padding: mobileTheme.spacing[3],
  fontSize: 11,
  lineHeight: 17,
})

export const NoticeText = styled(AppText)({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  color: mobileTheme.colors.teal,
  padding: mobileTheme.spacing[3],
  fontSize: 11,
  lineHeight: 17,
})

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
    gap: mobileTheme.spacing[4],
    padding: mobileTheme.spacing[4],
    paddingBottom: mobileTheme.spacing[8],
  },
})

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
})

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[4],
})

const StateMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})

const TopBar = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const BackButton = styled.Pressable({ minHeight: 44, justifyContent: "center" })
const BackLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "700",
})
const TopTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 13,
  fontWeight: "700",
})
const TopSpacer = styled.View({ width: 44 })
const Intro = styled.View({ gap: mobileTheme.spacing[1] })
const Title = styled(AppText)({
  color: mobileTheme.colors.ink,
  ...mobileTheme.typography.title,
})
const Description = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  lineHeight: 19,
})
