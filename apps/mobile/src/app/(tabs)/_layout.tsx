import styled from "@emotion/native"
import { Redirect, Tabs } from "expo-router"
import { observer } from "mobx-react-lite"
import { SafeAreaView } from "react-native-safe-area-context"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top", "bottom"] as const

export default observer(function MainTabsLayout() {
  const store = useMobileAppStore()

  if (store.authState === "anonymous") {
    return <Redirect href="/auth/login" />
  }
  if (store.authState !== "authenticated") {
    return (
      <LoadingPage edges={safeAreaEdges}>
        <LoadingText accessibilityLiveRegion="polite">
          로그인 상태를 확인하고 있어요.
        </LoadingText>
      </LoadingPage>
    )
  }
  if (store.requiresLegalConsent) {
    return <Redirect href="/consent" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: mobileTheme.colors.tealSoft,
        tabBarActiveTintColor: mobileTheme.colors.teal,
        tabBarInactiveTintColor: mobileTheme.colors.muted,
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "800",
        },
        tabBarStyle: {
          height: 64,
          backgroundColor: mobileTheme.colors.panel,
          borderTopColor: mobileTheme.colors.border,
          paddingHorizontal: 12,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarItemStyle: {
          borderRadius: mobileTheme.radii.md,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarAccessibilityLabel: "월별 홈",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarAccessibilityLabel: "앱 설정",
        }}
      />
    </Tabs>
  )
})

const LoadingPage = styled(SafeAreaView)`
  flex: 1;
  align-items: center;
  justify-content: center;
  background-color: ${mobileTheme.colors.canvas};
  padding: ${mobileTheme.spacing[5]}px;
`

const LoadingText = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
  text-align: center;
`
