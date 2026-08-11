import styled from "@emotion/native"
import { observer } from "mobx-react-lite"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top"] as const
const scrollContentStyle = { flexGrow: 1 } as const

export default observer(function SettingsScreen() {
  const store = useMobileAppStore()

  return (
    <Page edges={safeAreaEdges}>
      <ScrollView contentContainerStyle={scrollContentStyle}>
        <Content>
          <Eyebrow>살림온 모바일</Eyebrow>
          <Title accessibilityRole="header">설정</Title>

          <Section>
            <SectionTitle>로그인 계정</SectionTitle>
            <SettingRow>
              <SettingLabel>카카오 계정</SettingLabel>
              <SettingValue>
                {store.authUser?.nickname ?? "사용자"}
              </SettingValue>
            </SettingRow>
            <SettingRow>
              <SettingLabel>현재 가계부</SettingLabel>
              <SettingValue>{store.currentLedgerName}</SettingValue>
            </SettingRow>
          </Section>

          <Section>
            <SectionTitle>기기 데이터</SectionTitle>
            <Description>
              로그인 세션은 Android 암호화 저장소에 보관합니다. 월별 조회 캐시는
              앱 실행 중에만 유지되며 로그아웃하면 즉시 삭제됩니다.
            </Description>
          </Section>

          <AppButton
            disabled={store.authState === "signingOut"}
            label={
              store.authState === "signingOut" ? "로그아웃 중..." : "로그아웃"
            }
            onPress={() => void store.logout()}
          />
        </Content>
      </ScrollView>
    </Page>
  )
})

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const Content = styled.View`
  width: 100%;
  max-width: 720px;
  align-self: center;
  gap: ${mobileTheme.spacing[4]}px;
  padding: ${mobileTheme.spacing[6]}px ${mobileTheme.spacing[5]}px;
`

const Eyebrow = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
`

const Title = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 28px;
  font-weight: 800;
  line-height: 36px;
`

const Section = styled.View`
  gap: ${mobileTheme.spacing[3]}px;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[4]}px;
`

const SectionTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 700;
`

const SettingRow = styled.View`
  min-height: 32px;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[4]}px;
`

const SettingLabel = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`

const SettingValue = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-align: right;
`

const Description = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 13px;
  line-height: 20px;
`
