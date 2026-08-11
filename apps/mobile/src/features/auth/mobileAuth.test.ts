import type {
  AuthSessionInfo,
  SalimonSupabaseClient,
} from "@salimon/api-client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMobileAuthGateway } from "./mobileAuth"

const apiMocks = vi.hoisted(() => ({
  exchangeAuthCodeForSession: vi.fn(),
}))

vi.mock("@salimon/api-client", () => ({
  clearLocalAuthSession: vi.fn(),
  createKakaoOAuthUrl: vi.fn(),
  ensureAuthenticatedProfile: vi.fn(),
  exchangeAuthCodeForSession: apiMocks.exchangeAuthCodeForSession,
  getCurrentAuthSession: vi.fn(),
  observeAuthSession: vi.fn(),
  signOutFromSupabase: vi.fn(),
}))

vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}))

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}))

const session: AuthSessionInfo = {
  user: { id: "user-1", nickname: "살림 가족" },
  expiresAt: 1_800_000_000,
}

const client = {
  auth: {
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  },
} as unknown as SalimonSupabaseClient

describe("createMobileAuthGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exchanges the same callback code only once when handlers overlap", async () => {
    const pendingExchange = createDeferred<AuthSessionInfo>()
    apiMocks.exchangeAuthCodeForSession.mockReturnValueOnce(
      pendingExchange.promise,
    )
    const gateway = createMobileAuthGateway(client)

    const browserResult = gateway.completeCallbackUrl(
      "salimon://auth/callback?code=one-time-code",
    )
    const routeResult = gateway.completeCallbackUrl(
      "salimon://auth/callback?code=one-time-code",
    )
    pendingExchange.resolve(session)

    await expect(Promise.all([browserResult, routeResult])).resolves.toEqual([
      session,
      session,
    ])
    expect(apiMocks.exchangeAuthCodeForSession).toHaveBeenCalledOnce()
  })

  it("replaces an expired PKCE error with a user-facing message", async () => {
    apiMocks.exchangeAuthCodeForSession.mockRejectedValueOnce(
      new Error("invalid flow state, no valid flow state found"),
    )
    const gateway = createMobileAuthGateway(client)

    await expect(
      gateway.completeCallbackUrl("salimon://auth/callback?code=old-code"),
    ).rejects.toThrow(
      "이전 로그인 요청이 만료되었습니다. 카카오 로그인을 다시 시도해 주세요.",
    )
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}
