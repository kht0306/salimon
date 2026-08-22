import styled from "@emotion/native"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { AppState } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../components/AppText"
import { MobileStoreProvider } from "../stores/MobileStoreProvider"
import {
  createMobileAppStore,
  type MobileAppStore,
} from "../stores/mobileAppStore"
import { mobileTheme } from "../theme"

export { ErrorBoundary } from "expo-router"

void SplashScreen.preventAutoHideAsync()

const stackScreenOptions = { headerShown: false } as const
const safeAreaEdges = ["top", "bottom"] as const

type StoreCreationResult =
  | { store: MobileAppStore; error?: never }
  | { store?: never; error: string }

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Pretendard: require("pretendard/dist/public/variable/PretendardVariable.ttf"),
  })
  const [storeResult] = useState<StoreCreationResult>(() => {
    try {
      return { store: createMobileAppStore() }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "모바일 앱 설정을 확인하지 못했습니다.",
      }
    }
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync()
    }
  }, [fontError, fontsLoaded])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <SafeAreaProvider>
      {storeResult.store ? (
        <MobileRuntime store={storeResult.store} />
      ) : (
        <ConfigurationErrorScreen message={storeResult.error} />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  )
}

interface MobileRuntimeProps {
  store: MobileAppStore
}

function MobileRuntime({ store }: MobileRuntimeProps) {
  useEffect(() => {
    const stopObserving = store.observeAuthSession()
    const stopRefreshing = store.bindSessionRefresh()
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active" && store.authState === "authenticated") {
          void store.refreshNotificationInbox()
        }
      },
    )
    void store.initializeAuth()

    return () => {
      appStateSubscription.remove()
      stopObserving()
      stopRefreshing()
    }
  }, [store])

  return (
    <MobileStoreProvider store={store}>
      <Stack screenOptions={stackScreenOptions} />
    </MobileStoreProvider>
  )
}

interface ConfigurationErrorScreenProps {
  message: string
}

function ConfigurationErrorScreen({ message }: ConfigurationErrorScreenProps) {
  return (
    <ConfigurationPage edges={safeAreaEdges}>
      <ConfigurationCard accessibilityRole="alert">
        <ConfigurationLabel>앱 설정 필요</ConfigurationLabel>
        <ConfigurationTitle>
          Supabase 연결 정보를 확인해 주세요.
        </ConfigurationTitle>
        <ConfigurationDescription>{message}</ConfigurationDescription>
        <ConfigurationHint>
          apps/mobile/.env.local에 EXPO_PUBLIC_SUPABASE_URL과
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정한 뒤 개발 서버를 다시
          시작해 주세요.
        </ConfigurationHint>
      </ConfigurationCard>
    </ConfigurationPage>
  )
}

const ConfigurationPage = styled(SafeAreaView)`
  flex: 1;
  justify-content: center;
  background-color: ${mobileTheme.colors.canvas};
  padding: ${mobileTheme.spacing[4]}px;
`

const ConfigurationCard = styled.View`
  width: 100%;
  max-width: 520px;
  align-self: center;
  gap: ${mobileTheme.spacing[3]}px;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[6]}px;
`

const ConfigurationLabel = styled(AppText)`
  color: ${mobileTheme.colors.coral};
  font-size: 12px;
  font-weight: 700;
`

const ConfigurationTitle = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 22px;
  font-weight: 700;
  line-height: 29px;
`

const ConfigurationDescription = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 14px;
  line-height: 21px;
`

const ConfigurationHint = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 12px;
  line-height: 19px;
`
