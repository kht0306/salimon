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
          <ScreenHeader>
            <HeaderCopy>
              <Eyebrow>내 계정</Eyebrow>
              <Title accessibilityRole="header">설정</Title>
            </HeaderCopy>
            <BrandMark>
              <BrandInitial>S</BrandInitial>
            </BrandMark>
          </ScreenHeader>

          <ProfileCard>
            <Avatar>
              <AvatarText>
                {(store.authUser?.nickname ?? "사").slice(0, 1)}
              </AvatarText>
            </Avatar>
            <ProfileCopy>
              <ProfileName>{store.authUser?.nickname ?? "사용자"}</ProfileName>
              <ProfileProvider>카카오 계정으로 연결됨</ProfileProvider>
            </ProfileCopy>
            <ConnectedBadge>연결됨</ConnectedBadge>
          </ProfileCard>

          <Section>
            <SectionTitle>가계부</SectionTitle>
            <SettingRow>
              <SettingLabel>현재 선택</SettingLabel>
              <SettingValue>{store.currentLedgerName}</SettingValue>
            </SettingRow>
          </Section>

          <Section>
            <SectionTitle>보안 및 데이터</SectionTitle>
            <SecurityRow>
              <SecurityMark />
              <SecurityCopy>
                <SecurityTitle>이 기기의 로그인 보호</SecurityTitle>
                <Description>
                  로그인 세션은 Android 암호화 저장소에만 보관합니다.
                </Description>
              </SecurityCopy>
            </SecurityRow>
            <Divider />
            <SecurityRow>
              <SecurityMark />
              <SecurityCopy>
                <SecurityTitle>가계부 원본 미저장</SecurityTitle>
                <Description>
                  월별 조회 내용은 앱 실행 중에만 유지되고 로그아웃 시
                  삭제됩니다.
                </Description>
              </SecurityCopy>
            </SecurityRow>
          </Section>

          <LogoutArea>
            <AppButton
              disabled={store.authState === "signingOut"}
              label={
                store.authState === "signingOut" ? "로그아웃 중..." : "로그아웃"
              }
              onPress={() => void store.logout()}
            />
            <VersionText>살림온 Android · 가족 테스트 버전</VersionText>
          </LogoutArea>
        </Content>
      </ScrollView>
    </Page>
  )
})

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const Content = styled.View({
  width: "100%",
  maxWidth: 720,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[5],
})

const ScreenHeader = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const HeaderCopy = styled.View({ gap: mobileTheme.spacing[1] })

const Eyebrow = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
`

const Title = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 24px;
  font-weight: 900;
  line-height: 31px;
`

const BrandMark = styled.View({
  width: 38,
  height: 38,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.ink,
})

const BrandInitial = styled.Text`
  color: ${mobileTheme.colors.panel};
  font-size: 17px;
  font-weight: 900;
`

const ProfileCard = styled.View({
  minHeight: 84,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const Avatar = styled.View({
  width: 48,
  height: 48,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.tealSoft,
})

const AvatarText = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 18px;
  font-weight: 900;
`

const ProfileCopy = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const ProfileName = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 16px;
  font-weight: 800;
`

const ProfileProvider = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
`

const ConnectedBadge = styled.Text({
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.greenSoft,
  color: mobileTheme.colors.green,
  fontSize: 10,
  fontWeight: "800",
  paddingVertical: mobileTheme.spacing[1],
  paddingHorizontal: mobileTheme.spacing[2],
})

const Section = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const SectionTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 700;
`

const SettingRow = styled.View({
  minHeight: 32,
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[4],
})

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

const SecurityRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: mobileTheme.spacing[3],
})

const SecurityMark = styled.View({
  width: 8,
  height: 8,
  marginTop: 5,
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.teal,
})

const SecurityCopy = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const SecurityTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 700;
`

const Divider = styled.View({
  height: 1,
  backgroundColor: mobileTheme.colors.border,
})

const LogoutArea = styled.View({
  gap: mobileTheme.spacing[3],
  marginTop: mobileTheme.spacing[2],
})

const VersionText = styled.Text`
  color: ${mobileTheme.colors.subtle};
  font-size: 10px;
  text-align: center;
`
