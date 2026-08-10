import styled from "@emotion/native"
import { Redirect } from "expo-router"
import { observer } from "mobx-react-lite"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../components/AppButton"
import { StatusRow } from "../components/StatusRow"
import { useMobileAppStore } from "../stores/MobileStoreProvider"
import { mobileTheme } from "../theme"

const scrollContentStyle = { flexGrow: 1 } as const
const safeAreaEdges = ["top", "bottom"] as const

export default observer(function MobileAuthStatusScreen() {
  const store = useMobileAppStore()

  if (store.authState === "anonymous") {
    return <Redirect href="./auth/login" />
  }
  if (store.authState !== "authenticated") {
    return <CenteredMessage message="로그인 상태를 확인하고 있어요." />
  }
  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return <CenteredMessage message="가계부를 안전하게 불러오고 있어요." />
  }
  if (store.dataStatus === "error") {
    return (
      <CenteredMessage
        actionLabel="다시 불러오기"
        message={
          store.dataErrorMessage ?? "가계부 데이터를 불러오지 못했습니다."
        }
        onAction={() => void store.loadSelectedMonth()}
        secondaryActionLabel="로그아웃"
        onSecondaryAction={() => void store.logout()}
      />
    )
  }
  if (store.requiresLegalConsent) {
    return <Redirect href="./consent" />
  }

  const statusItems = [
    {
      label: "카카오 로그인",
      detail: `${store.authUser?.nickname ?? "사용자"} 계정 연결됨`,
    },
    {
      label: "보안 세션 복원",
      detail: "Android 암호화 저장소 · 자동 갱신 연결됨",
    },
    {
      label: "가계부 연결",
      detail: `${store.currentLedgerName} · ${store.selectedMonth} 거래 ${store.financeData.transactions.length}건`,
    },
  ] as const

  return (
    <Page edges={safeAreaEdges}>
      <PageScroll contentContainerStyle={scrollContentStyle}>
        <Content>
          <Eyebrow>살림온 모바일 · 3회차</Eyebrow>
          <Title accessibilityRole="header">
            로그인과 세션 복원이 연결됐어요.
          </Title>
          <Description>
            카카오 계정으로 실제 가계부를 불러왔습니다. 앱을 다시 실행해도 인증
            상태를 복원하며, 일반 가계부 데이터는 기기 저장소에 남기지 않습니다.
          </Description>

          <StatusPanel accessibilityLabel="모바일 인증 연결 상태">
            {statusItems.map((item) => (
              <StatusRow
                key={item.label}
                detail={item.detail}
                label={item.label}
              />
            ))}
          </StatusPanel>

          <NextPanel>
            <NextLabel>다음 단계</NextLabel>
            <NextTitle>4회차에서 월별 홈 화면을 구성합니다.</NextTitle>
            <NextDescription>
              가계부 전환, 월 이동, 수입·지출·저축 요약과 최근 거래를 모바일
              화면에 맞게 표시합니다.
            </NextDescription>
          </NextPanel>

          <LogoutAction>
            <AppButton label="로그아웃" onPress={() => void store.logout()} />
          </LogoutAction>
        </Content>
      </PageScroll>
    </Page>
  )
})

interface CenteredMessageProps {
  actionLabel?: string
  message: string
  onAction?: () => void
  onSecondaryAction?: () => void
  secondaryActionLabel?: string
}

function CenteredMessage({
  actionLabel,
  message,
  onAction,
  onSecondaryAction,
  secondaryActionLabel,
}: CenteredMessageProps) {
  return (
    <Page edges={safeAreaEdges}>
      <CenteredContent>
        <CenteredText accessibilityLiveRegion="polite">{message}</CenteredText>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} onPress={onAction} tone="primary" />
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <AppButton label={secondaryActionLabel} onPress={onSecondaryAction} />
        ) : null}
      </CenteredContent>
    </Page>
  )
}

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const PageScroll = styled.ScrollView`
  flex: 1;
`

const Content = styled.View`
  width: 100%;
  max-width: 720px;
  align-self: center;
  flex: 1;
  justify-content: center;
  padding: ${mobileTheme.spacing[6]}px ${mobileTheme.spacing[5]}px;
`

const CenteredContent = styled.View`
  width: 100%;
  max-width: 420px;
  align-self: center;
  flex: 1;
  justify-content: center;
  gap: ${mobileTheme.spacing[3]}px;
  padding: ${mobileTheme.spacing[5]}px;
`

const CenteredText = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
  text-align: center;
`

const Eyebrow = styled.Text`
  margin-bottom: ${mobileTheme.spacing[3]}px;
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
`

const Title = styled.Text`
  max-width: 560px;
  color: ${mobileTheme.colors.ink};
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.7px;
  line-height: 38px;
`

const Description = styled.Text`
  max-width: 600px;
  margin-top: ${mobileTheme.spacing[3]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
`

const StatusPanel = styled.View`
  margin-top: ${mobileTheme.spacing[6]}px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
`

const NextPanel = styled.View`
  margin-top: ${mobileTheme.spacing[4]}px;
  border-left-width: 3px;
  border-left-color: ${mobileTheme.colors.teal};
  background-color: ${mobileTheme.colors.tealSoft};
  padding: ${mobileTheme.spacing[4]}px;
`

const NextLabel = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 11px;
  font-weight: 700;
`

const NextTitle = styled.Text`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 700;
  line-height: 21px;
`

const NextDescription = styled.Text`
  margin-top: ${mobileTheme.spacing[2]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`

const LogoutAction = styled.View`
  margin-top: ${mobileTheme.spacing[4]}px;
`
