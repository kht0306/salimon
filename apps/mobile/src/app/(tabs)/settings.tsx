import styled from "@emotion/native"
import { useFocusEffect } from "expo-router"
import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useState } from "react"
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Switch,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { NotificationDisclosureModal } from "../../features/notification-inbox/NotificationDisclosureModal"
import { SUPPORTED_NOTIFICATION_APPS } from "../../features/notification-inbox/notificationInbox"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top"] as const
const scrollContentStyle = { flexGrow: 1 } as const

export default observer(function SettingsScreen() {
  const store = useMobileAppStore()
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [disclosureBusy, setDisclosureBusy] = useState(false)
  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
  const [targetLedgerId, setTargetLedgerId] = useState("")
  const notificationStatusTone = !store.notificationCaptureStatus
    .isCollectionEnabled
    ? "inactive"
    : store.notificationCaptureStatus.hasNotificationAccess
      ? "active"
      : "warning"

  useFocusEffect(
    useCallback(() => {
      void store.refreshNotificationInbox()
    }, [store]),
  )

  useEffect(() => {
    setSelectedPackages(store.notificationCaptureStatus.allowedPackageNames)
    setTargetLedgerId(store.notificationTargetLedgerId)
  }, [
    store.notificationCaptureStatus.allowedPackageNames,
    store.notificationTargetLedgerId,
  ])

  async function acceptDisclosureAndContinue(): Promise<void> {
    setDisclosureBusy(true)
    const accepted = await store.acceptNotificationPrivacyDisclosure()
    if (!accepted) {
      setDisclosureBusy(false)
      return
    }

    const allowedPackageNames =
      selectedPackages.length > 0
        ? selectedPackages
        : [SUPPORTED_NOTIFICATION_APPS[0].packageName]
    const ledgerId = targetLedgerId || store.selectedLedgerId
    const configured = await store.configureNotificationInbox({
      allowedPackageNames,
      enabled: true,
      reviewNotificationsEnabled: false,
      targetLedgerId: ledgerId,
    })
    setDisclosureBusy(false)
    if (!configured) return

    setSelectedPackages(allowedPackageNames)
    setTargetLedgerId(ledgerId)
    setDisclosureOpen(false)
    await store.openNotificationPermissionSettings()
  }

  async function saveNotificationSettings(): Promise<void> {
    if (selectedPackages.length === 0) {
      Alert.alert("지원 앱을 선택해 주세요.")
      return
    }
    const saved = await store.configureNotificationInbox({
      allowedPackageNames: selectedPackages,
      enabled: true,
      targetLedgerId: targetLedgerId || store.selectedLedgerId,
    })
    if (saved) Alert.alert("알림 후보함 설정을 저장했습니다.")
  }

  async function toggleReviewNotification(enabled: boolean): Promise<void> {
    if (!store.notificationCaptureStatus.hasNotificationAccess) {
      Alert.alert(
        "알림 접근을 먼저 허용해 주세요.",
        "결제 알림 감지를 허용한 다음 후보 도착 알림을 켤 수 있습니다.",
      )
      return
    }

    if (
      enabled &&
      Platform.OS === "android" &&
      Number(Platform.Version) >= 33
    ) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      )
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          "알림 표시 권한이 꺼져 있어요.",
          "후보는 계속 저장되며 후보함에서 직접 확인할 수 있습니다.",
        )
        return
      }
    }

    await store.configureNotificationInbox({
      allowedPackageNames: selectedPackages,
      enabled: true,
      reviewNotificationsEnabled: enabled,
      targetLedgerId: targetLedgerId || store.selectedLedgerId,
    })
  }

  function stopNotificationInbox(): void {
    Alert.alert(
      "알림 후보함을 끌까요?",
      "수집을 중지하고 기기에 보관된 후보와 암호화 원문을 모두 삭제합니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "중지 및 삭제",
          style: "destructive",
          onPress: () =>
            void store.configureNotificationInbox({
              allowedPackageNames: selectedPackages,
              enabled: false,
              reviewNotificationsEnabled: false,
              targetLedgerId: targetLedgerId || store.selectedLedgerId,
            }),
        },
      ],
    )
  }

  function revokeNotificationConsent(): void {
    Alert.alert(
      "알림 동의를 철회할까요?",
      "수집 설정과 보관된 후보·암호화 원문이 모두 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "동의 철회",
          style: "destructive",
          onPress: () => void store.revokeNotificationPrivacyDisclosure(),
        },
      ],
    )
  }

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
            <SectionHeader>
              <SectionTitle>결제 알림 후보함</SectionTitle>
              <StatusText
                $tone={notificationStatusTone}
                accessibilityLiveRegion="polite"
              >
                {store.notificationCaptureStatus.isCollectionEnabled
                  ? store.notificationCaptureStatus.hasNotificationAccess
                    ? "사용 중"
                    : "알림 접근 필요"
                  : "사용 안 함"}
              </StatusText>
            </SectionHeader>
            <Description>
              선택한 앱의 결제 알림만 기기에 최대 7일간 암호화 보관합니다.
              원문과 미확정 후보는 서버로 전송하지 않습니다.
            </Description>

            {!store.notificationCaptureStatus.hasDisclosureConsent ? (
              <AppButton
                label="안내 확인 후 설정 시작"
                tone="primary"
                onPress={() => setDisclosureOpen(true)}
              />
            ) : (
              <>
                <Divider />
                <SettingGroup>
                  <SettingGroupLabel>지원 앱</SettingGroupLabel>
                  {SUPPORTED_NOTIFICATION_APPS.map((app) => {
                    const selected = selectedPackages.includes(app.packageName)
                    return (
                      <SelectionButton
                        key={app.packageName}
                        $selected={selected}
                        accessibilityLabel={app.name}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        onPress={() =>
                          setSelectedPackages((packages) =>
                            selected
                              ? packages.filter(
                                  (packageName) =>
                                    packageName !== app.packageName,
                                )
                              : [...packages, app.packageName],
                          )
                        }
                      >
                        <SelectionMark
                          $selected={selected}
                          accessibilityElementsHidden
                          allowFontScaling={false}
                          importantForAccessibility="no"
                        >
                          {selected ? "✓" : ""}
                        </SelectionMark>
                        <SelectionCopy>
                          <SelectionTitle>{app.name}</SelectionTitle>
                          <SelectionDescription>
                            실제 기기에서 확인한 지원 앱
                          </SelectionDescription>
                        </SelectionCopy>
                      </SelectionButton>
                    )
                  })}
                </SettingGroup>

                <SettingGroup>
                  <SettingGroupLabel>등록 대상 가계부</SettingGroupLabel>
                  <LedgerOptions>
                    {store.selectableLedgers.map((ledger) => {
                      const selected = targetLedgerId === ledger.id
                      return (
                        <LedgerButton
                          key={ledger.id}
                          $selected={selected}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() => setTargetLedgerId(ledger.id)}
                        >
                          <LedgerLabel $selected={selected}>
                            {ledger.name}
                          </LedgerLabel>
                        </LedgerButton>
                      )
                    })}
                  </LedgerOptions>
                </SettingGroup>

                <PermissionRow>
                  <PermissionCopy>
                    <SecurityTitle>Android 알림 접근</SecurityTitle>
                    <Description>
                      {store.notificationCaptureStatus.hasNotificationAccess
                        ? "허용됨"
                        : "허용이 필요합니다."}
                    </Description>
                  </PermissionCopy>
                  <InlineButton
                    accessibilityLabel="Android 알림 접근 설정 열기"
                    accessibilityRole="button"
                    onPress={() =>
                      void store.openNotificationPermissionSettings()
                    }
                  >
                    <InlineButtonLabel>설정 열기</InlineButtonLabel>
                  </InlineButton>
                </PermissionRow>

                <PermissionRow>
                  <PermissionCopy>
                    <SecurityTitle>후보 도착 알림</SecurityTitle>
                    <Description>
                      꺼도 후보함에는 정상적으로 저장됩니다.
                    </Description>
                  </PermissionCopy>
                  <Switch
                    accessibilityLabel="후보 도착 알림"
                    trackColor={{
                      false: mobileTheme.colors.borderStrong,
                      true: mobileTheme.colors.teal,
                    }}
                    value={
                      store.notificationCaptureStatus.reviewNotificationsEnabled
                    }
                    onValueChange={(enabled) =>
                      void toggleReviewNotification(enabled)
                    }
                  />
                </PermissionRow>

                {store.notificationInboxErrorMessage ? (
                  <ErrorText
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                  >
                    {store.notificationInboxErrorMessage}
                  </ErrorText>
                ) : null}
                <AppButton
                  disabled={selectedPackages.length === 0 || !targetLedgerId}
                  label="후보함 설정 저장"
                  tone="primary"
                  onPress={() => void saveNotificationSettings()}
                />
                {store.notificationCaptureStatus.isCollectionEnabled ? (
                  <AppButton
                    label="수집 중지 및 후보 삭제"
                    onPress={stopNotificationInbox}
                  />
                ) : null}
                <TextAction
                  accessibilityRole="button"
                  onPress={revokeNotificationConsent}
                >
                  <TextActionLabel>알림 동의 철회</TextActionLabel>
                </TextAction>
              </>
            )}
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
      {disclosureOpen ? (
        <NotificationDisclosureModal
          busy={disclosureBusy}
          onAccept={() => void acceptDisclosureAndContinue()}
          onClose={() => setDisclosureOpen(false)}
        />
      ) : null}
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
  backgroundColor: mobileTheme.colors.tealSoft,
  color: mobileTheme.colors.teal,
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

const SectionHeader = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const StatusText = styled.Text<{
  $tone: "active" | "inactive" | "warning"
}>(({ $tone }) => ({
  color:
    $tone === "active"
      ? mobileTheme.colors.teal
      : $tone === "warning"
        ? mobileTheme.colors.coral
        : mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "800",
}))

const SettingGroup = styled.View({ gap: mobileTheme.spacing[2] })

const SettingGroupLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
})

const SelectionButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panelSubtle,
    padding: mobileTheme.spacing[3],
  }),
)

const SelectionMark = styled.Text<{ $selected: boolean }>(({ $selected }) => ({
  width: 24,
  height: 24,
  borderWidth: 2,
  borderColor: $selected
    ? mobileTheme.colors.teal
    : mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: $selected
    ? mobileTheme.colors.teal
    : mobileTheme.colors.panel,
  color: mobileTheme.colors.panel,
  fontSize: 16,
  fontWeight: "900",
  lineHeight: 20,
  textAlign: "center",
}))

const SelectionCopy = styled.View({ flex: 1, gap: 2 })
const SelectionTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "800",
})
const SelectionDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
})

const LedgerOptions = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[2],
})
const LedgerButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.round,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)
const LedgerLabel = styled.Text<{ $selected: boolean }>(({ $selected }) => ({
  color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "800",
}))

const PermissionRow = styled.View({
  minHeight: 52,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})
const PermissionCopy = styled.View({ minWidth: 0, flex: 1, gap: 2 })
const InlineButton = styled.Pressable({
  minHeight: 40,
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.tealSoft,
  paddingHorizontal: mobileTheme.spacing[3],
})
const InlineButtonLabel = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})
const ErrorText = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 11,
  lineHeight: 18,
  padding: mobileTheme.spacing[3],
})
const TextAction = styled.Pressable({
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
})
const TextActionLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  textDecorationLine: "underline",
})

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
