import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import type { Currency } from "@salimon/types"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusRow } from "../components/StatusRow"
import { mobileTheme } from "../theme"

const baselineCurrency: Currency = "KRW"
const safeAreaEdges = ["top", "bottom"] as const
const scrollContentStyle = { flexGrow: 1 } as const

const foundationItems = [
  {
    label: "Android 앱 기반",
    detail: "Expo SDK 57 · React Native 0.86",
  },
  {
    label: "공용 패키지 연결",
    detail: `types · domain · UI tokens · ${baselineCurrency} ${formatKrw(0)}`,
  },
  {
    label: "개발 빌드",
    detail: "Expo Development Client · com.salimon.app",
  },
] as const

export default function MobileFoundationScreen() {
  return (
    <Page edges={safeAreaEdges}>
      <PageScroll contentContainerStyle={scrollContentStyle}>
        <Content>
          <Eyebrow>살림온 모바일 · 1회차</Eyebrow>
          <Title accessibilityRole="header">
            가족 알파를 위한 기반이 준비됐어요.
          </Title>
          <Description>
            지금은 화면과 공용 코드가 Android 개발 빌드에서 함께 동작하는지
            확인하는 단계입니다. 로그인과 실제 가계부 연결은 다음 회차에서
            이어집니다.
          </Description>

          <StatusPanel accessibilityLabel="모바일 기반 준비 상태">
            {foundationItems.map((item) => (
              <StatusRow
                key={item.label}
                label={item.label}
                detail={item.detail}
              />
            ))}
          </StatusPanel>

          <NextPanel>
            <NextLabel>다음 단계</NextLabel>
            <NextTitle>
              웹과 모바일의 Supabase 연결 경계를 분리합니다.
            </NextTitle>
            <NextDescription>
              브라우저 전용 환경변수와 인증 처리를 분리한 뒤 카카오 로그인과
              월별 가계부 조회를 연결합니다.
            </NextDescription>
          </NextPanel>
        </Content>
      </PageScroll>
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
