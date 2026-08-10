import styled from "@emotion/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusRow } from "../components/StatusRow"
import { mobileTheme } from "../theme"

const safeAreaEdges = ["top", "bottom"] as const
const scrollContentStyle = { flexGrow: 1 } as const

const dataBoundaryItems = [
  {
    label: "클라이언트 경계",
    detail: "NEXT_PUBLIC_* · EXPO_PUBLIC_* 완전 분리",
  },
  {
    label: "월별 데이터 조회",
    detail: "선택 월 거래 · 해당 거래 분할 내역만 요청",
  },
  {
    label: "웹 호환성",
    detail: "기존 로그인 · 전체 데이터 로드 동작 유지",
  },
] as const

export default function MobileFoundationScreen() {
  return (
    <Page edges={safeAreaEdges}>
      <PageScroll contentContainerStyle={scrollContentStyle}>
        <Content>
          <Eyebrow>살림온 모바일 · 2회차</Eyebrow>
          <Title accessibilityRole="header">
            모바일 데이터 연결 경계를 분리했어요.
          </Title>
          <Description>
            웹 동작은 그대로 유지하면서 모바일이 별도 Supabase 설정과 선택 월
            조회를 사용할 수 있게 준비했습니다. 실제 로그인 세션 연결 전까지
            인증 정보는 저장하지 않습니다.
          </Description>

          <StatusPanel accessibilityLabel="모바일 데이터 경계 준비 상태">
            {dataBoundaryItems.map((item) => (
              <StatusRow
                key={item.label}
                label={item.label}
                detail={item.detail}
              />
            ))}
          </StatusPanel>

          <NextPanel>
            <NextLabel>다음 단계</NextLabel>
            <NextTitle>카카오 로그인과 세션 복원을 연결합니다.</NextTitle>
            <NextDescription>
              앱 딥링크를 통해 로그인 결과를 받고, 안전한 기기 저장소에서 인증
              상태를 복원한 뒤 실제 월별 가계부를 표시합니다.
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
