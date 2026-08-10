import styled from "@emotion/native"
import { Redirect } from "expo-router"
import { observer } from "mobx-react-lite"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top", "bottom"] as const

export default observer(function LoginScreen() {
  const store = useMobileAppStore()

  if (store.authState === "authenticated") {
    return <Redirect href="/" />
  }

  const isLoading =
    store.authState === "checking" || store.authState === "authenticating"

  return (
    <Page edges={safeAreaEdges}>
      <Content>
        <Brand>살림온</Brand>
        <Title accessibilityRole="header">가족의 생활비를 한곳에서</Title>
        <Description>
          웹에서 사용하던 카카오 계정으로 로그인하면 같은 가계부를 안전하게
          불러옵니다.
        </Description>

        <LoginCard>
          <CardTitle>카카오 계정으로 시작하기</CardTitle>
          <CardDescription>
            로그인 세션만 기기의 암호화 저장소에 보관하며, 가계부 데이터는
            저장하지 않습니다.
          </CardDescription>
          {store.authErrorMessage ? (
            <ErrorText accessibilityLiveRegion="polite">
              {store.authErrorMessage}
            </ErrorText>
          ) : null}
          <AppButton
            disabled={isLoading}
            label={isLoading ? "로그인 확인 중..." : "카카오로 로그인"}
            onPress={() => void store.loginWithKakao()}
            tone="kakao"
          />
        </LoginCard>
      </Content>
    </Page>
  )
})

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const Content = styled.View`
  width: 100%;
  max-width: 560px;
  align-self: center;
  flex: 1;
  justify-content: center;
  padding: ${mobileTheme.spacing[6]}px ${mobileTheme.spacing[5]}px;
`

const Brand = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
`

const Title = styled.Text`
  margin-top: ${mobileTheme.spacing[3]}px;
  color: ${mobileTheme.colors.ink};
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 40px;
`

const Description = styled.Text`
  margin-top: ${mobileTheme.spacing[3]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
`

const LoginCard = styled.View`
  gap: ${mobileTheme.spacing[3]}px;
  margin-top: ${mobileTheme.spacing[8]}px;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[5]}px;
`

const CardTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 17px;
  font-weight: 700;
`

const CardDescription = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`

const ErrorText = styled.Text`
  border-radius: ${mobileTheme.radii.sm}px;
  background-color: ${mobileTheme.colors.coralSoft};
  color: ${mobileTheme.colors.coral};
  font-size: 12px;
  line-height: 18px;
  padding: ${mobileTheme.spacing[3]}px;
`
