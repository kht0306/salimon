import {
  clearLocalAuthSession,
  createKakaoOAuthUrl,
  ensureAuthenticatedProfile,
  exchangeAuthCodeForSession,
  getCurrentAuthSession,
  observeAuthSession,
  signOutFromSupabase,
  type AuthSessionEvent,
  type AuthSessionInfo,
  type SalimonSupabaseClient,
} from "@salimon/api-client"
import * as WebBrowser from "expo-web-browser"
import { AppState, type AppStateStatus } from "react-native"

export const MOBILE_AUTH_REDIRECT_URL = "salimon://auth/callback"

WebBrowser.maybeCompleteAuthSession()

export type MobileLoginResult =
  | { status: "authenticated"; session: AuthSessionInfo }
  | { status: "cancelled" }

export interface MobileAuthGateway {
  getCurrentSession(): Promise<AuthSessionInfo | null>
  observe(
    listener: (
      event: AuthSessionEvent,
      session: AuthSessionInfo | null,
    ) => void,
  ): () => void
  loginWithKakao(): Promise<MobileLoginResult>
  completeCallbackUrl(url: string): Promise<AuthSessionInfo>
  ensureProfile(): Promise<void>
  clearLocalSession(): Promise<void>
  signOut(): Promise<void>
  bindSessionRefresh(): () => void
}

export function createMobileAuthGateway(
  client: SalimonSupabaseClient,
): MobileAuthGateway {
  let lastCompletedCallback:
    { code: string; session: AuthSessionInfo } | undefined

  async function completeCallbackUrl(url: string): Promise<AuthSessionInfo> {
    const callback = parseAuthCallbackUrl(url)
    if (lastCompletedCallback?.code === callback.code) {
      return lastCompletedCallback.session
    }

    const session = await exchangeAuthCodeForSession(client, callback.code)
    lastCompletedCallback = { code: callback.code, session }
    return session
  }

  return {
    getCurrentSession: () => getCurrentAuthSession(client),
    observe: (listener) => observeAuthSession(listener, client),

    async loginWithKakao(): Promise<MobileLoginResult> {
      const loginUrl = await createKakaoOAuthUrl(
        client,
        MOBILE_AUTH_REDIRECT_URL,
      )
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        MOBILE_AUTH_REDIRECT_URL,
      )

      if (result.type !== "success") {
        return { status: "cancelled" }
      }

      return {
        status: "authenticated",
        session: await completeCallbackUrl(result.url),
      }
    },

    completeCallbackUrl,
    ensureProfile: () => ensureAuthenticatedProfile(client),
    clearLocalSession: () => clearLocalAuthSession(client),
    signOut: () => signOutFromSupabase(client),

    bindSessionRefresh(): () => void {
      const syncRefresh = (state: AppStateStatus): void => {
        if (state === "active") {
          client.auth.startAutoRefresh()
        } else {
          client.auth.stopAutoRefresh()
        }
      }

      syncRefresh(AppState.currentState)
      const subscription = AppState.addEventListener("change", syncRefresh)
      return () => {
        subscription.remove()
        client.auth.stopAutoRefresh()
      }
    },
  }
}

function parseAuthCallbackUrl(url: string): { code: string } {
  const callbackUrl = new URL(url)
  const errorDescription =
    callbackUrl.searchParams.get("error_description") ??
    callbackUrl.searchParams.get("error")
  if (errorDescription) {
    throw new Error(errorDescription)
  }

  const code = callbackUrl.searchParams.get("code")
  if (!code) {
    throw new Error("카카오 로그인 결과를 확인하지 못했습니다.")
  }

  return { code }
}
