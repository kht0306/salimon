import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@supabase/supabase-js"

const { exchangeCodeForSession, rpc, signInWithOAuth, signOut } = vi.hoisted(
  () => ({
    exchangeCodeForSession: vi.fn(),
    rpc: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
)

vi.mock("./supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { exchangeCodeForSession, signInWithOAuth, signOut },
    rpc,
  }),
}))

import {
  clearLocalAuthSession,
  createKakaoOAuthUrl,
  ensureAuthenticatedProfile,
  exchangeAuthCodeForSession as exchangeCode,
  mapAuthUser,
} from "./authClient"
import type { SalimonSupabaseClient } from "./supabaseClient"

beforeEach(() => {
  rpc.mockReset()
  exchangeCodeForSession.mockReset()
  signInWithOAuth.mockReset()
  signOut.mockReset()
})

describe("mapAuthUser", () => {
  it("maps provider metadata without requiring browser state", () => {
    const user = {
      id: "user-1",
      email: "family@example.com",
      user_metadata: {
        full_name: "살림 가족",
        avatar_url: "https://example.com/avatar.png",
      },
      identities: [
        {
          provider: "kakao",
          identity_data: { sub: "kakao-1" },
        },
      ],
    } as unknown as User

    expect(mapAuthUser(user)).toEqual({
      id: "user-1",
      email: "family@example.com",
      nickname: "살림 가족",
      avatarUrl: "https://example.com/avatar.png",
      kakaoId: "kakao-1",
    })
  })
})

describe("ensureAuthenticatedProfile", () => {
  it("only requires the profile initialization request to succeed", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(ensureAuthenticatedProfile()).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith("ensure_user_profile")
  })

  it("surfaces the profile initialization error message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "프로필 생성에 실패했습니다." },
    })

    await expect(ensureAuthenticatedProfile()).rejects.toThrow(
      "프로필 생성에 실패했습니다.",
    )
  })
})

describe("clearLocalAuthSession", () => {
  it("clears only the current browser session", async () => {
    signOut.mockResolvedValue({ error: null })

    await expect(clearLocalAuthSession()).resolves.toBeUndefined()
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("surfaces a local session cleanup error", async () => {
    signOut.mockResolvedValue({
      error: { message: "로그인 상태를 정리하지 못했습니다." },
    })

    await expect(clearLocalAuthSession()).rejects.toThrow(
      "로그인 상태를 정리하지 못했습니다.",
    )
  })
})

describe("mobile OAuth helpers", () => {
  const client = {
    auth: { exchangeCodeForSession, signInWithOAuth },
  } as unknown as SalimonSupabaseClient

  it("creates a Kakao authorization URL without redirecting the browser", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.supabase.co/auth/v1/authorize" },
      error: null,
    })

    await expect(
      createKakaoOAuthUrl(client, "salimon://auth/callback"),
    ).resolves.toBe("https://example.supabase.co/auth/v1/authorize")
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: {
        redirectTo: "salimon://auth/callback",
        skipBrowserRedirect: true,
      },
    })
  })

  it("exchanges the PKCE callback code for a mobile session", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          expires_at: 1_800_000_000,
          user: {
            id: "user-1",
            email: "family@example.com",
            user_metadata: { name: "살림 가족" },
            identities: [],
          },
        },
      },
      error: null,
    })

    await expect(exchangeCode(client, "pkce-code")).resolves.toEqual({
      user: {
        id: "user-1",
        email: "family@example.com",
        nickname: "살림 가족",
        avatarUrl: undefined,
        kakaoId: undefined,
      },
      expiresAt: 1_800_000_000,
    })
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
  })
})
