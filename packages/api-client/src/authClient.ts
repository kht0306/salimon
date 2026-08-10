import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import {
  getSupabaseBrowserClient,
  type SalimonSupabaseClient,
} from "./supabaseClient"

declare const process: {
  env: Record<string, string | undefined>
}

export interface AuthUserInfo {
  id: string
  email?: string
  nickname: string
  avatarUrl?: string
  kakaoId?: string
}

export interface AuthSessionInfo {
  user: AuthUserInfo
  expiresAt?: number
}

export type AuthSessionEvent = AuthChangeEvent

export async function signInWithKakao(): Promise<void> {
  const client = requireSupabaseClient()
  const redirectTo = getAuthCallbackUrl()
  const { error } = await client.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo },
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signOutFromSupabase(
  injectedClient?: SalimonSupabaseClient,
): Promise<void> {
  const client = injectedClient ?? requireSupabaseClient()
  const { error } = await client.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function clearLocalAuthSession(
  injectedClient?: SalimonSupabaseClient,
): Promise<void> {
  const client = injectedClient ?? requireSupabaseClient()
  const { error } = await client.auth.signOut({ scope: "local" })

  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentAuthSession(
  injectedClient?: SalimonSupabaseClient,
): Promise<AuthSessionInfo | null> {
  const client = injectedClient ?? requireSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return mapAuthSession(data.session)
}

export async function getCurrentAccessToken(
  injectedClient?: SalimonSupabaseClient,
): Promise<string | null> {
  const client = injectedClient ?? requireSupabaseClient()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message)
  return data.session?.access_token ?? null
}

export function observeAuthSession(
  listener: (event: AuthChangeEvent, session: AuthSessionInfo | null) => void,
  injectedClient?: SalimonSupabaseClient,
): () => void {
  const client = injectedClient ?? getSupabaseBrowserClient()
  if (!client) {
    return () => undefined
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    listener(event, mapAuthSession(session))
  })

  return () => data.subscription.unsubscribe()
}

export async function ensureAuthenticatedProfile(
  injectedClient?: SalimonSupabaseClient,
): Promise<void> {
  const client = injectedClient ?? requireSupabaseClient()
  const { error } = await client.rpc("ensure_user_profile")

  if (error) {
    throw new Error(error.message)
  }
}

export async function createKakaoOAuthUrl(
  client: SalimonSupabaseClient,
  redirectTo: string,
): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
  if (!data.url) {
    throw new Error("카카오 로그인 주소를 확인하지 못했습니다.")
  }

  return data.url
}

export async function exchangeAuthCodeForSession(
  client: SalimonSupabaseClient,
  code: string,
): Promise<AuthSessionInfo> {
  const { data, error } = await client.auth.exchangeCodeForSession(code)
  if (error) {
    throw new Error(error.message)
  }

  const session = mapAuthSession(data.session)
  if (!session) {
    throw new Error("로그인 세션을 확인할 수 없습니다.")
  }

  return session
}

export async function completeAuthCallback(): Promise<AuthSessionInfo> {
  const client = requireSupabaseClient()
  const code =
    typeof window === "undefined"
      ? null
      : new URL(window.location.href).searchParams.get("code")

  if (code) {
    return exchangeAuthCodeForSession(client, code)
  }

  const session = await getCurrentAuthSession()
  if (!session) {
    throw new Error(readOAuthError() ?? "로그인 세션을 확인할 수 없습니다.")
  }

  return session
}

function requireSupabaseClient() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  }

  return client
}

function getAuthCallbackUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return `${appUrl ?? "http://localhost:3000"}/auth/callback`
}

export function mapAuthSession(
  session: Session | null,
): AuthSessionInfo | null {
  if (!session) {
    return null
  }

  return {
    user: mapAuthUser(session.user),
    expiresAt: session.expires_at,
  }
}

export function mapAuthUser(user: User): AuthUserInfo {
  const metadata = user.user_metadata
  const kakaoIdentity = user.identities?.find(
    (identity) => identity.provider === "kakao",
  )
  const nickname = firstString(
    metadata.name,
    metadata.user_name,
    metadata.full_name,
    metadata.preferred_username,
    user.email?.split("@")[0],
  )
  const avatarUrl = firstString(metadata.avatar_url, metadata.picture)
  const kakaoId = firstString(kakaoIdentity?.identity_data?.sub, metadata.sub)

  return {
    id: user.id,
    email: user.email,
    nickname: nickname ?? "Salimon 사용자",
    avatarUrl,
    kakaoId,
  }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  )
}

function readOAuthError(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  return search.get("error_description") ?? hash.get("error_description")
}
