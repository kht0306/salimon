import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock("./supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({ rpc }),
}))

import { ensureAuthenticatedProfile } from "./authClient"

beforeEach(() => {
  rpc.mockReset()
})

describe("ensureAuthenticatedProfile", () => {
  it("only requires the profile initialization request to succeed", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(ensureAuthenticatedProfile()).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith("ensure_user_profile")
  })
})
