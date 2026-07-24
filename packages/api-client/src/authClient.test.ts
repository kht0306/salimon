import { beforeEach, describe, expect, it, vi } from "vitest"

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
} from "./authClient"

beforeEach(() => {
  rpc.mockReset()
  signOut.mockReset()
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
