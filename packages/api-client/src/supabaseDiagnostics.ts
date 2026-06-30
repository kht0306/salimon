import { getSupabaseBrowserClient } from "./supabaseClient"

declare const process: {
  env: Record<string, string | undefined>
}

export type SupabaseConnectionState = "idle" | "checking" | "configured" | "missing_env" | "error"

export interface SupabaseConnectionCheck {
  state: SupabaseConnectionState
  hasUrl: boolean
  hasAnonKey: boolean
  canReachAuth: boolean
  canReachSchema: boolean
  isAuthenticated: boolean
  checkedAt?: string
  message: string
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionCheck> {
  const client = getSupabaseBrowserClient()
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!client) {
    return {
      state: "missing_env",
      hasUrl,
      hasAnonKey,
      canReachAuth: false,
      canReachSchema: false,
      isAuthenticated: false,
      checkedAt: new Date().toISOString(),
      message: "Supabase 환경변수가 아직 설정되지 않았습니다.",
    }
  }

  try {
    const sessionResult = await client.auth.getSession()
    const schemaResult = await client.from("profiles").select("id", { count: "exact", head: true })

    if (schemaResult.error) {
      return {
        state: "error",
        hasUrl,
        hasAnonKey,
        canReachAuth: !sessionResult.error,
        canReachSchema: false,
        isAuthenticated: Boolean(sessionResult.data.session),
        checkedAt: new Date().toISOString(),
        message: `Supabase 연결은 됐지만 profiles 테이블 확인에 실패했습니다: ${schemaResult.error.message}`,
      }
    }

    return {
      state: "configured",
      hasUrl,
      hasAnonKey,
      canReachAuth: !sessionResult.error,
      canReachSchema: true,
      isAuthenticated: Boolean(sessionResult.data.session),
      checkedAt: new Date().toISOString(),
      message: "Supabase URL/key와 기본 스키마 접근이 정상입니다.",
    }
  } catch (error) {
    return {
      state: "error",
      hasUrl,
      hasAnonKey,
      canReachAuth: false,
      canReachSchema: false,
      isAuthenticated: false,
      checkedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Supabase 연결 확인 중 알 수 없는 오류가 발생했습니다.",
    }
  }
}
