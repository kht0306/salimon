import {
  createEmptyFinanceData,
  observeAuthSession,
  type AuthSessionInfo,
  type SupabaseFinanceRepository,
  type TransactionData,
} from "@salimon/api-client"
import { AppStore } from "@salimon/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  checkSupabaseConnection: vi.fn(),
  ensureAuthenticatedProfile: vi.fn(),
  getCurrentAuthSession: vi.fn(),
  observeAuthSession: vi.fn(),
}))

vi.mock("@salimon/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@salimon/api-client")>()
  return {
    ...actual,
    checkSupabaseConnection: authMocks.checkSupabaseConnection,
    ensureAuthenticatedProfile: authMocks.ensureAuthenticatedProfile,
    getCurrentAuthSession: authMocks.getCurrentAuthSession,
    observeAuthSession: authMocks.observeAuthSession,
  }
})

const session: AuthSessionInfo = {
  user: { id: "user-1", nickname: "사용자" },
  expiresAt: 1_800_000_000,
}

function createFinanceData() {
  const data = createEmptyFinanceData()
  data.profile = {
    id: "user-1",
    nickname: "사용자",
    defaultCurrency: "KRW",
    timezone: "Asia/Seoul",
    monthlySummaryVisible: true,
  }
  return data
}

describe("AppStore authentication initialization", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authMocks.ensureAuthenticatedProfile.mockResolvedValue(undefined)
    authMocks.getCurrentAuthSession.mockResolvedValue(session)
    authMocks.checkSupabaseConnection.mockResolvedValue({
      state: "configured",
      hasUrl: true,
      hasAnonKey: true,
      canReachAuth: true,
      canReachSchema: true,
      isAuthenticated: true,
      message: "연결됨",
    })
  })

  it("coalesces the initial auth event and session lookup into one data load", async () => {
    let listener: Parameters<typeof observeAuthSession>[0] | undefined
    authMocks.observeAuthSession.mockImplementation((nextListener) => {
      listener = nextListener
      return () => undefined
    })
    const financeData = createFinanceData()
    const repository = {
      loadMonth: vi.fn(async () => financeData),
      loadTransactions: vi.fn(
        async (): Promise<TransactionData> => ({
          transactions: [],
          transactionSplits: [],
        }),
      ),
    }
    const store = new AppStore(
      repository as unknown as SupabaseFinanceRepository,
    )
    const selectedMonth = store.selectedMonth

    store.observeAuth()
    const initialization = store.initializeAuth()
    listener?.("INITIAL_SESSION", session)
    await initialization

    expect(authMocks.ensureAuthenticatedProfile).toHaveBeenCalledOnce()
    expect(repository.loadMonth).toHaveBeenCalledOnce()
    expect(repository.loadMonth).toHaveBeenCalledWith("user-1", selectedMonth, {
      transactionDateRange: {
        start: `${selectedMonth}-01T00:00:00+09:00`,
        endExclusive: nextMonthStart(selectedMonth),
      },
    })

    listener?.("TOKEN_REFRESHED", session)
    await Promise.resolve()
    expect(repository.loadMonth).toHaveBeenCalledOnce()
  })
})

function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`
}
