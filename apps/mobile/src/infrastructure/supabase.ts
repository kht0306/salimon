import {
  createSalimonSupabaseClient,
  type SalimonSupabaseClient,
} from "@salimon/api-client"

let mobileClient: SalimonSupabaseClient | null = null

export function getSupabaseMobileClient(): SalimonSupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    return null
  }

  if (!mobileClient) {
    mobileClient = createSalimonSupabaseClient({
      url,
      publishableKey,
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  }

  return mobileClient
}

export function requireSupabaseMobileClient(): SalimonSupabaseClient {
  const client = getSupabaseMobileClient()
  if (!client) {
    throw new Error("모바일 Supabase 환경변수가 설정되지 않았습니다.")
  }

  return client
}
