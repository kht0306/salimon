import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@supabase/supabase-js"

const { rpc, signOut } = vi.hoisted(() => ({
  rpc: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("./supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut }, rpc }),
}))

import {
  clearLocalAuthSession,
  ensureAuthenticatedProfile,
  mapAuthUser,
} from "./authClient"

beforeEach(() => {
  rpc.mockReset()
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
