import styled from "@emotion/native"
import { Redirect } from "expo-router"
import { observer } from "mobx-react-lite"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
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
        <TopBar>
          <BrandLockup accessibilityLabel="살림온">
            <BrandMark>
              <BrandInitial>살</BrandInitial>
            </BrandMark>
            <BrandName>살림온</BrandName>
          </BrandLockup>
          <ProductLabel>가족 가계부</ProductLabel>
        </TopBar>

        <Hero>
          <Eyebrow>우리 가족의 돈 관리</Eyebrow>
          <Title accessibilityRole="header">
            생활비 흐름을{`\n`}가족과 함께 확인하세요
          </Title>
          <Description>
            웹에서 쓰던 가계부와 같은 계정으로 연결됩니다. 이번 달 지출부터
            날짜별 거래까지 모바일에서 빠르게 확인하세요.
          </Description>

          <BenefitList>
            <BenefitRow>
              <BenefitDot />
              <BenefitText>웹과 모바일에서 같은 가계부 사용</BenefitText>
            </BenefitRow>
            <BenefitRow>
              <BenefitDot />
              <BenefitText>기기 암호화 저장소로 로그인 상태 보호</BenefitText>
            </BenefitRow>
          </BenefitList>
        </Hero>

        <ActionArea>
          <CardTitle>카카오 계정으로 계속하기</CardTitle>
          <CardDescription>
            가계부 원본은 기기에 저장하지 않으며, 로그인 세션만 안전하게
            보관합니다.
          </CardDescription>
          {store.authErrorMessage ? (
            <ErrorText accessibilityLiveRegion="polite">
              {store.authErrorMessage}
            </ErrorText>
          ) : null}
          <AppButton
            disabled={isLoading}
            label={isLoading ? "로그인 확인 중..." : "카카오로 시작하기"}
            onPress={() => void store.loginWithKakao()}
            tone="kakao"
          />
        </ActionArea>
      </Content>
    </Page>
  )
})

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const Content = styled.View({
  width: "100%",
  maxWidth: 560,
  alignSelf: "center",
  flex: 1,
  justifyContent: "space-between",
  gap: mobileTheme.spacing[6],
  paddingTop: mobileTheme.spacing[5],
  paddingRight: mobileTheme.spacing[5],
  paddingBottom: mobileTheme.spacing[6],
  paddingLeft: mobileTheme.spacing[5],
})

const TopBar = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const BrandLockup = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const BrandMark = styled.View({
  width: 34,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.teal,
})

const BrandInitial = styled(AppText)`
  color: ${mobileTheme.colors.panel};
  font-size: 16px;
  font-weight: 700;
`

const BrandName = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
`

const ProductLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
  font-weight: 700;
`

const Hero = styled.View({ gap: mobileTheme.spacing[3] })

const Eyebrow = styled(AppText)`
  color: ${mobileTheme.colors.teal};
  font-size: 14px;
  font-weight: 600;
`

const Title = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 29px;
  font-weight: 700;
  letter-spacing: -0.7px;
  line-height: 38px;
`

const Description = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 14px;
  line-height: 22px;
`

const BenefitList = styled.View({
  gap: mobileTheme.spacing[2],
  marginTop: mobileTheme.spacing[2],
})

const BenefitRow = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const BenefitDot = styled.View({
  width: 6,
  height: 6,
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.teal,
})

const BenefitText = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
`

const ActionArea = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[5],
})

const CardTitle = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 16px;
  font-weight: 600;
`

const CardDescription = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`

const ErrorText = styled(AppText)({
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 12,
  lineHeight: 18,
  padding: mobileTheme.spacing[3],
})
