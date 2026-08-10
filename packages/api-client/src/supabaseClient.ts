import {
  createClient as createSupabaseJsClient,
  type SupabaseClient,
  type SupabaseClientOptions as SupabaseJsClientOptions,
  type SupportedStorage,
} from "@supabase/supabase-js"

declare const process: {
  env: Record<string, string | undefined>
}

let browserClient: SupabaseClient | null = null

export type SupabaseClientAuthOptions = NonNullable<
  SupabaseJsClientOptions<"public">["auth"]
>

export interface SupabaseClientOptions {
  url: string
  publishableKey: string
  auth: SupabaseClientAuthOptions
}

export type SalimonSupabaseClient = SupabaseClient
export type SupabaseAuthStorage = SupportedStorage

export function createSalimonSupabaseClient({
  url,
  publishableKey,
  auth,
}: SupabaseClientOptions): SalimonSupabaseClient {
  return createSupabaseJsClient(url, publishableKey, { auth })
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const env = getRuntimeEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  if (!browserClient) {
    browserClient = createSalimonSupabaseClient({
      url,
      publishableKey: anonKey,
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  }

  return browserClient
}

function getRuntimeEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}
