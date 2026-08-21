import styled from "@emotion/native"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useRef } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
import { MOBILE_AUTH_REDIRECT_URL } from "../../features/auth/mobileAuth"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top", "bottom"] as const

interface CallbackSearchParams {
  code?: string | string[]
  error?: string | string[]
  error_description?: string | string[]
}

export default function AuthCallbackScreen() {
  const store = useMobileAppStore()
  const routeParams = useLocalSearchParams()
  const params: CallbackSearchParams = {
    code: routeParams.code,
    error: routeParams.error,
    error_description: routeParams.error_description,
  }
  const callbackKey = createCallbackUrl(params)
  const lastAttemptedUrl = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!callbackKey || lastAttemptedUrl.current === callbackKey) return
    lastAttemptedUrl.current = callbackKey

    void store.completeAuthCallback(callbackKey).then(() => {
      if (store.authState === "authenticated") {
        router.replace("/")
      } else {
        router.replace("./login")
      }
    })
  }, [callbackKey, store])

  return (
    <Page edges={safeAreaEdges}>
      <Progress accessibilityLiveRegion="polite">
        카카오 로그인 결과를 확인하고 있어요.
      </Progress>
    </Page>
  )
}

function createCallbackUrl(params: CallbackSearchParams): string | undefined {
  const code = firstValue(params.code)
  const oauthError = firstValue(params.error)
  const errorDescription = firstValue(params.error_description)
  if (!code && !oauthError && !errorDescription) return undefined

  const searchParams = new URLSearchParams()
  if (code) searchParams.set("code", code)
  if (oauthError) searchParams.set("error", oauthError)
  if (errorDescription) {
    searchParams.set("error_description", errorDescription)
  }
  return `${MOBILE_AUTH_REDIRECT_URL}?${searchParams.toString()}`
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const Page = styled(SafeAreaView)({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: mobileTheme.colors.canvas,
  padding: mobileTheme.spacing[5],
})

const Progress = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
  text-align: center;
`
