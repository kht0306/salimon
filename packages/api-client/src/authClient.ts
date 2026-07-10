import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "./supabaseClient"

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

export async function signInWithKakao(): Promise<void> {
  const client = requireSupabaseClient()
  const redirectTo = getAuthCallbackUrl()
  const { error } = await client.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo },
  })

  if (error) {
    throw error
  }
}

export async function signOutFromSupabase(): Promise<void> {
  const client = requireSupabaseClient()
  const { error } = await client.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentAuthSession(): Promise<AuthSessionInfo | null> {
  const client = requireSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw error
  }

  return toAuthSessionInfo(data.session)
}

export function observeAuthSession(
  listener: (event: AuthChangeEvent, session: AuthSessionInfo | null) => void,
): () => void {
  const client = getSupabaseBrowserClient()
  if (!client) {
    return () => undefined
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    listener(event, toAuthSessionInfo(session))
  })

  return () => data.subscription.unsubscribe()
}

export async function ensureAuthenticatedWorkspace(): Promise<string> {
  const client = requireSupabaseClient()
  const { data, error } = await client.rpc("ensure_user_workspace")

  if (error) {
    throw error
  }

  if (typeof data !== "string") {
    throw new Error("기본 가계부 초기화 결과를 확인할 수 없습니다.")
  }

  return data
}

export async function completeAuthCallback(): Promise<AuthSessionInfo> {
  const client = requireSupabaseClient()
  const code = typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("code")

  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code)
    if (error) {
      throw error
    }

    const session = toAuthSessionInfo(data.session)
    if (session) {
      return session
    }
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

function toAuthSessionInfo(session: Session | null): AuthSessionInfo | null {
  if (!session) {
    return null
  }

  return {
    user: toAuthUserInfo(session.user),
    expiresAt: session.expires_at,
  }
}

function toAuthUserInfo(user: User): AuthUserInfo {
  const metadata = user.user_metadata
  const kakaoIdentity = user.identities?.find((identity) => identity.provider === "kakao")
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
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)
}

function readOAuthError(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  return search.get("error_description") ?? hash.get("error_description")
}
