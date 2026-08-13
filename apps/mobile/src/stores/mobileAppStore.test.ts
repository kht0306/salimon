import {
  createEmptyFinanceData,
  DuplicateTransactionSourceError,
  type AuthSessionInfo,
  type FinanceData,
  type FinanceMutationOptions,
  type RemoteTransactionInput,
} from "@salimon/api-client"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@salimon/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MobileAuthGateway } from "../features/auth/mobileAuth"
import { QueryCache } from "../infrastructure/queryCache"
import {
  acceptNotificationDisclosure,
  clearNotificationCaptureSession,
  configureNotificationCapture,
  deleteAllStoredNotificationRecords,
  deleteStoredNotificationRecord,
  getNotificationCaptureStatus,
  readStoredNotificationRecords,
  revokeNotificationDisclosure,
  setAuthenticatedNotificationCaptureUser,
  saveStoredNotificationRegistrationState,
} from "../native/notificationListener"
import { MobileAppStore } from "./mobileAppStore"

vi.mock("../features/auth/mobileAuth", () => ({
  createMobileAuthGateway: vi.fn(),
}))

vi.mock("../infrastructure/supabase", () => ({
  requireSupabaseMobileClient: vi.fn(),
}))

vi.mock("../native/notificationListener", () => ({
  acceptNotificationDisclosure: vi.fn(),
  clearNotificationCaptureSession: vi.fn(async () => undefined),
  configureNotificationCapture: vi.fn(),
  deleteAllStoredNotificationRecords: vi.fn(async () => undefined),
  deleteExpiredNotificationRecords: vi.fn(async () => 0),
  deleteStoredNotificationRecord: vi.fn(async () => true),
  getNotificationCaptureStatus: vi.fn(),
  openNotificationAccessSettings: vi.fn(async () => undefined),
  readStoredNotificationRecords: vi.fn(async () => []),
  revokeNotificationDisclosure: vi.fn(),
  setAuthenticatedNotificationCaptureUser: vi.fn(async () => undefined),
  saveStoredNotificationRegistrationState: vi.fn(async () => true),
}))

const emptyNotificationStatus = {
  allowedPackageNames: [],
  disclosureAcceptedAt: 0,
  hasDisclosureConsent: false,
  hasNotificationAccess: false,
  isCollectionEnabled: false,
  retentionDays: 7,
  reviewNotificationsEnabled: false,
  storedRecordCount: 0,
  targetLedgerId: "",
}

const session: AuthSessionInfo = {
  user: { id: "user-1", nickname: "살림 가족" },
  expiresAt: 1_800_000_000,
}

function createReadyFinanceData() {
  const data = createEmptyFinanceData()
  data.profile = {
    id: "user-1",
    nickname: "살림 가족",
    defaultCurrency: "KRW",
    timezone: "Asia/Seoul",
  }
  data.ledgers = [
    {
      id: "ledger-1",
      ownerId: "user-1",
      name: "우리집",
      type: "personal",
      currency: "KRW",
      role: "owner",
    },
  ]
  data.members = [
    {
      id: "member-1",
      ledgerId: "ledger-1",
      userId: "user-1",
      nickname: "살림 가족",
      role: "owner",
      status: "active",
      isDefault: true,
      joinedAt: "2026-08-10T00:00:00.000Z",
    },
  ]
  data.legalConsent = {
    userId: "user-1",
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedAt: "2026-08-10T00:00:00.000Z",
  }
  return data
}

function createRepository(data = createReadyFinanceData()) {
  return {
    acceptLegalTerms: vi.fn(async () => "consent-1"),
    createLedger: vi.fn(async () => "ledger-1"),
    load: vi.fn(async () => data),
    materializeMonth: vi.fn(async () => undefined),
    saveTransaction: vi.fn(
      async (
        _userId: string,
        _input: RemoteTransactionInput,
        _options?: FinanceMutationOptions,
      ) => "transaction-new",
    ),
    softDeleteTransaction: vi.fn(async () => undefined),
  }
}

function createAuthGateway(
  overrides: Partial<MobileAuthGateway> = {},
): MobileAuthGateway {
  return {
    bindSessionRefresh: vi.fn(() => () => undefined),
    clearLocalSession: vi.fn(async () => undefined),
    completeCallbackUrl: vi.fn(async () => session),
    ensureProfile: vi.fn(async () => undefined),
    getCurrentSession: vi.fn(async () => session),
    loginWithKakao: vi.fn(async () => ({
      status: "authenticated" as const,
      session,
    })),
    observe: vi.fn(() => () => undefined),
    signOut: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe("MobileAppStore authentication", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(clearNotificationCaptureSession).mockClear()
    vi.mocked(setAuthenticatedNotificationCaptureUser).mockClear()
    vi.mocked(deleteStoredNotificationRecord).mockClear()
    vi.mocked(saveStoredNotificationRegistrationState).mockClear()
    vi.mocked(getNotificationCaptureStatus).mockResolvedValue(
      emptyNotificationStatus,
    )
    vi.mocked(readStoredNotificationRecords).mockResolvedValue([])
    vi.mocked(saveStoredNotificationRegistrationState).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("restores the secure session and loads only the selected month", async () => {
    const repository = createRepository()
    const gateway = createAuthGateway()
    const store = new MobileAppStore(
      repository,
      gateway,
      new Date("2026-08-10T12:00:00+09:00"),
    )

    await store.initializeAuth()

    expect(store.authState).toBe("authenticated")
    expect(store.dataStatus).toBe("ready")
    expect(store.currentLedgerName).toBe("우리집")
    expect(gateway.ensureProfile).toHaveBeenCalledOnce()
    expect(repository.materializeMonth).toHaveBeenCalledWith("2026-08")
    expect(repository.load).toHaveBeenCalledWith("user-1", {
      transactionDateRange: {
        start: "2026-08-01T00:00:00+09:00",
        endExclusive: "2026-09-01T00:00:00+09:00",
      },
    })
    expect(setAuthenticatedNotificationCaptureUser).toHaveBeenCalledWith(
      "user-1",
    )
  })

  it("returns to the login state without an error when login is cancelled", async () => {
    const store = new MobileAppStore(
      createRepository(),
      createAuthGateway({
        loginWithKakao: vi.fn(async () => ({
          status: "cancelled" as const,
        })),
      }),
    )

    await store.loginWithKakao()

    expect(store.authState).toBe("anonymous")
    expect(store.authErrorMessage).toBeUndefined()
  })

  it("keeps a restored session when an old callback is replayed", async () => {
    const gateway = createAuthGateway({
      completeCallbackUrl: vi.fn(async () => {
        throw new Error(
          "이전 로그인 요청이 만료되었습니다. 카카오 로그인을 다시 시도해 주세요.",
        )
      }),
      getCurrentSession: vi.fn(async () => session),
    })
    const store = new MobileAppStore(createRepository(), gateway)

    await store.completeAuthCallback("salimon://auth/callback?code=old-code")

    expect(store.authState).toBe("authenticated")
    expect(store.authErrorMessage).toBeUndefined()
    expect(gateway.clearLocalSession).not.toHaveBeenCalled()
  })

  it("clears an invalid callback only when no session can be restored", async () => {
    const gateway = createAuthGateway({
      completeCallbackUrl: vi.fn(async () => {
        throw new Error("로그인 요청이 만료되었습니다.")
      }),
      getCurrentSession: vi.fn(async () => null),
    })
    const store = new MobileAppStore(createRepository(), gateway)

    await store.completeAuthCallback("salimon://auth/callback?code=old-code")

    expect(store.authState).toBe("anonymous")
    expect(store.authErrorMessage).toBe("로그인 요청이 만료되었습니다.")
    expect(gateway.clearLocalSession).toHaveBeenCalledOnce()
  })

  it("creates one initial personal ledger only when the account has none", async () => {
    const emptyData = createEmptyFinanceData()
    emptyData.profile = createReadyFinanceData().profile
    const readyData = createReadyFinanceData()
    const repository = createRepository()
    repository.load
      .mockResolvedValueOnce(emptyData)
      .mockResolvedValueOnce(readyData)
    const store = new MobileAppStore(repository, createAuthGateway())

    await store.initializeAuth()

    expect(repository.createLedger).toHaveBeenCalledOnce()
    expect(repository.createLedger).toHaveBeenCalledWith({
      name: "내 가계부",
      type: "personal",
      setDefault: true,
      paymentInstrumentIds: [],
      ledgerVisibleInstrumentIds: [],
    })
    expect(repository.load).toHaveBeenCalledTimes(2)
    expect(store.dataStatus).toBe("ready")
  })

  it("clears all in-memory finance data on logout", async () => {
    const gateway = createAuthGateway()
    const store = new MobileAppStore(createRepository(), gateway)
    await store.initializeAuth()

    await store.logout()

    expect(gateway.signOut).toHaveBeenCalledOnce()
    expect(store.authState).toBe("anonymous")
    expect(store.authUser).toBeUndefined()
    expect(store.financeData.ledgers).toEqual([])
    expect(store.financeData.transactions).toEqual([])
    expect(store.dataStatus).toBe("idle")
    expect(clearNotificationCaptureSession).toHaveBeenCalled()
  })

  it("clears notification records when no secure session exists", async () => {
    const gateway = createAuthGateway({
      getCurrentSession: vi.fn(async () => null),
    })
    const store = new MobileAppStore(createRepository(), gateway)

    await store.initializeAuth()

    expect(clearNotificationCaptureSession).toHaveBeenCalledOnce()
    expect(store.authState).toBe("anonymous")
  })

  it("returns safely to login when the restored session expires", async () => {
    const listeners: Parameters<MobileAuthGateway["observe"]>[0][] = []
    const gateway = createAuthGateway({
      observe: vi.fn((listener) => {
        listeners.push(listener)
        return () => undefined
      }),
    })
    const store = new MobileAppStore(createRepository(), gateway)
    store.observeAuthSession()
    await store.initializeAuth()

    listeners[0]?.("SIGNED_OUT", null)

    expect(store.authState).toBe("anonymous")
    expect(store.financeData.ledgers).toEqual([])
    expect(store.authErrorMessage).toBe(
      "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    )
    expect(clearNotificationCaptureSession).toHaveBeenCalled()
  })

  it("records the current legal versions and reloads the account", async () => {
    const dataWithoutConsent = createReadyFinanceData()
    dataWithoutConsent.legalConsent = undefined
    const repository = createRepository(dataWithoutConsent)
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()
    expect(store.requiresLegalConsent).toBe(true)

    repository.load.mockResolvedValue(createReadyFinanceData())
    await store.acceptLegalTerms()

    expect(repository.acceptLegalTerms).toHaveBeenCalledWith(
      CURRENT_TERMS_VERSION,
      CURRENT_PRIVACY_VERSION,
    )
    expect(store.requiresLegalConsent).toBe(false)
    expect(store.consentStatus).toBe("idle")
  })

  it("creates masked notification candidates and deletes the native record when excluded", async () => {
    const captureStatus = {
      ...emptyNotificationStatus,
      allowedPackageNames: ["com.lotte"],
      disclosureAcceptedAt: Date.now(),
      hasDisclosureConsent: true,
      hasNotificationAccess: true,
      isCollectionEnabled: true,
      storedRecordCount: 1,
      targetLedgerId: "ledger-1",
    }
    vi.mocked(getNotificationCaptureStatus).mockResolvedValue(captureStatus)
    vi.mocked(readStoredNotificationRecords).mockResolvedValue([
      {
        capturedAt: Date.now(),
        expandedText: "12,000원 승인\n쇼핑엔 로카(8*3*)\n08/13 14:00",
        id: "a".repeat(64),
        receivedAt: new Date("2026-08-13T14:00:00+09:00").getTime(),
        sourcePackageName: "com.lotte",
        text: "12,000원 승인",
        title: "테스트상점",
      },
    ])
    const store = new MobileAppStore(createRepository(), createAuthGateway())

    await store.initializeAuth()

    expect(store.notificationCandidateCount).toBe(1)
    expect(store.notificationCandidates[0]?.maskedMessage).not.toContain(
      "(8*3*)",
    )

    await expect(
      store.excludeNotificationCandidate("a".repeat(64)),
    ).resolves.toBe(true)
    expect(deleteStoredNotificationRecord).toHaveBeenCalledWith("a".repeat(64))
    expect(store.notificationCandidateCount).toBe(0)
  })

  it("persists a candidate before saving and deletes it only after success", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-13T14:01:00+09:00"))
    const data = createReadyFinanceData()
    data.categories = [createExpenseCategory()]
    const repository = createRepository(data)
    mockCapturedNotification()
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    const result = await store.registerNotificationCandidate({
      amount: "45000",
      candidateId: "a".repeat(64),
      categoryId: "category-1",
      date: "2026-08-13",
      ledgerId: "ledger-1",
      merchantName: "테스트주유소",
      paymentMethodId: "",
      time: "14:00",
    })

    expect(result).toEqual({
      status: "saved",
      transactionId: "transaction-new",
    })
    expect(saveStoredNotificationRegistrationState).toHaveBeenCalledWith(
      "a".repeat(64),
      expect.objectContaining({
        amount: 45_000,
        categoryId: "category-1",
        targetLedgerId: "ledger-1",
      }),
    )
    expect(repository.saveTransaction).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        sourceApp: "com.lotte",
        sourceHash: expect.any(String),
        sourceType: "android_sms_notification",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(
      vi.mocked(saveStoredNotificationRegistrationState).mock
        .invocationCallOrder[0],
    ).toBeLessThan(repository.saveTransaction.mock.invocationCallOrder[0]!)
    expect(repository.saveTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteStoredNotificationRecord).mock.invocationCallOrder[0]!,
    )
    expect(store.notificationCandidateCount).toBe(0)
  })

  it("keeps an encrypted pending candidate on network failure and retries once", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-13T14:01:00+09:00"))
    const data = createReadyFinanceData()
    data.categories = [createExpenseCategory()]
    const repository = createRepository(data)
    repository.saveTransaction.mockRejectedValueOnce(
      new Error("network unavailable"),
    )
    mockCapturedNotification()
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()
    const draft = {
      amount: "45000",
      candidateId: "a".repeat(64),
      categoryId: "category-1",
      date: "2026-08-13",
      ledgerId: "ledger-1",
      merchantName: "수정한 주유소",
      paymentMethodId: "",
      time: "14:00",
    }

    await expect(store.registerNotificationCandidate(draft)).resolves.toEqual({
      status: "pending",
    })
    expect(deleteStoredNotificationRecord).not.toHaveBeenCalled()
    expect(store.notificationCandidates[0]).toMatchObject({
      status: "registration_pending",
      registrationState: {
        amount: 45_000,
        categoryId: "category-1",
        merchantName: "수정한 주유소",
      },
    })

    repository.saveTransaction.mockResolvedValueOnce("transaction-retry")
    await expect(store.registerNotificationCandidate(draft)).resolves.toEqual({
      status: "saved",
      transactionId: "transaction-retry",
    })
    expect(repository.saveTransaction).toHaveBeenCalledTimes(2)
    expect(deleteStoredNotificationRecord).toHaveBeenCalledOnce()
  })

  it("turns a source hash collision into already registered and cleans the candidate", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-13T14:01:00+09:00"))
    const data = createReadyFinanceData()
    data.categories = [createExpenseCategory()]
    const repository = createRepository(data)
    repository.saveTransaction.mockRejectedValueOnce(
      new DuplicateTransactionSourceError(),
    )
    mockCapturedNotification()
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    await expect(
      store.registerNotificationCandidate({
        amount: "45000",
        candidateId: "a".repeat(64),
        categoryId: "category-1",
        date: "2026-08-13",
        ledgerId: "ledger-1",
        merchantName: "테스트주유소",
        paymentMethodId: "",
        time: "14:00",
      }),
    ).resolves.toEqual({ status: "already_registered" })
    expect(deleteStoredNotificationRecord).toHaveBeenCalledWith("a".repeat(64))
    expect(store.notificationCandidateCount).toBe(0)
  })

  it("keeps notification collection disabled until disclosure consent", async () => {
    vi.mocked(acceptNotificationDisclosure).mockResolvedValue({
      ...emptyNotificationStatus,
      disclosureAcceptedAt: Date.now(),
      hasDisclosureConsent: true,
    })
    vi.mocked(configureNotificationCapture).mockResolvedValue({
      ...emptyNotificationStatus,
      allowedPackageNames: ["com.lotte"],
      disclosureAcceptedAt: Date.now(),
      hasDisclosureConsent: true,
      isCollectionEnabled: true,
      targetLedgerId: "ledger-1",
    })
    vi.mocked(revokeNotificationDisclosure).mockResolvedValue(
      emptyNotificationStatus,
    )
    const store = new MobileAppStore(createRepository(), createAuthGateway())
    await store.initializeAuth()

    await expect(
      store.configureNotificationInbox({
        allowedPackageNames: ["com.lotte"],
        enabled: true,
        targetLedgerId: "ledger-1",
      }),
    ).resolves.toBe(false)
    expect(configureNotificationCapture).not.toHaveBeenCalled()

    await expect(store.acceptNotificationPrivacyDisclosure()).resolves.toBe(
      true,
    )
    await expect(
      store.configureNotificationInbox({
        allowedPackageNames: ["com.lotte"],
        enabled: true,
        targetLedgerId: "ledger-1",
      }),
    ).resolves.toBe(true)

    await store.deleteAllNotificationCandidates()
    expect(deleteAllStoredNotificationRecords).toHaveBeenCalled()
  })

  it("selects the default ledger first and calculates each ledger independently", async () => {
    const data = createReadyFinanceData()
    data.ledgers.push({
      id: "ledger-2",
      ownerId: "user-1",
      name: "여행",
      type: "shared",
      currency: "KRW",
      role: "owner",
    })
    data.members.push({
      id: "member-2",
      ledgerId: "ledger-2",
      userId: "user-1",
      nickname: "살림 가족",
      role: "owner",
      status: "active",
      isDefault: false,
      joinedAt: "2026-08-10T00:00:00.000Z",
    })
    data.transactions = [
      createTransaction("expense-1", "ledger-1", "expense", 12_000, 10),
      createTransaction("income-1", "ledger-1", "income", 500_000, 10),
      createTransaction("saving-1", "ledger-2", "saving", 80_000, 11),
    ]
    const store = new MobileAppStore(
      createRepository(data),
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
    )

    await store.initializeAuth()

    expect(store.selectedLedgerId).toBe("ledger-1")
    expect(store.monthTotals).toEqual({
      expense: 12_000,
      income: 500_000,
      saving: 0,
    })
    store.selectLedger("ledger-2")
    expect(store.currentLedgerName).toBe("여행")
    expect(store.monthTotals).toEqual({
      expense: 0,
      income: 0,
      saving: 80_000,
    })
  })

  it("reuses a fresh month cache and refreshes only when requested", async () => {
    const repository = createRepository()
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    await store.loadSelectedMonth()
    expect(repository.load).toHaveBeenCalledOnce()

    await store.refreshSelectedMonth()
    expect(repository.load).toHaveBeenCalledTimes(2)
  })

  it("keeps the last successful month read-only when refresh fails", async () => {
    const data = createReadyFinanceData()
    data.transactions = [
      createTransaction("expense-1", "ledger-1", "expense", 12_000, 10),
    ]
    const repository = createRepository(data)
    const store = new MobileAppStore(
      repository,
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
      new QueryCache(),
    )
    await store.initializeAuth()
    repository.load.mockRejectedValueOnce(new Error("network unavailable"))

    await store.refreshSelectedMonth()

    expect(store.dataStatus).toBe("stale")
    expect(store.monthTransactions).toHaveLength(1)
    expect(store.dataErrorMessage).toContain("읽기 전용")
  })

  it("uses the latest effective category budget and matching expense", async () => {
    const data = createReadyFinanceData()
    data.categories = [
      {
        id: "food",
        ledgerId: "ledger-1",
        type: "expense",
        usageTypes: ["expense"],
        name: "식비",
        icon: "utensils",
        color: "#d65a3a",
        sortOrder: 0,
        isDefault: true,
        isArchived: false,
      },
    ]
    data.categoryBudgets = [
      {
        id: "budget-july",
        ledgerId: "ledger-1",
        categoryId: "food",
        effectiveMonth: "2026-07",
        amount: 300_000,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "budget-august",
        ledgerId: "ledger-1",
        categoryId: "food",
        effectiveMonth: "2026-08",
        amount: 350_000,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ]
    data.transactions = [
      {
        ...createTransaction("expense-1", "ledger-1", "expense", 12_000, 10),
        categoryId: "food",
      },
    ]
    const store = new MobileAppStore(
      createRepository(data),
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
    )

    await store.initializeAuth()

    expect(store.selectedMonthBudgets).toHaveLength(1)
    expect(store.selectedMonthBudgets[0]).toMatchObject({
      amount: 350_000,
      spent: 12_000,
    })
  })

  it("selects the month note for the current ledger only", async () => {
    const data = createReadyFinanceData()
    data.monthNotes = [
      {
        id: "note-current",
        ledgerId: "ledger-1",
        month: "2026-08",
        note: "공과금 3만원은 다음 달 이월",
        updatedBy: "user-1",
        updatedAt: "2026-08-10T00:00:00+09:00",
      },
      {
        id: "note-other-month",
        ledgerId: "ledger-1",
        month: "2026-07",
        note: "지난달 메모",
        updatedBy: "user-1",
        updatedAt: "2026-07-10T00:00:00+09:00",
      },
    ]
    const store = new MobileAppStore(
      createRepository(data),
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
    )

    await store.initializeAuth()

    expect(store.selectedMonthNote?.id).toBe("note-current")
    expect(store.selectedMonthNote?.note).toBe("공과금 3만원은 다음 달 이월")
  })

  it("saves a general transaction once and force refreshes its month", async () => {
    const repository = createRepository()
    const store = new MobileAppStore(
      repository,
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
    )
    await store.initializeAuth()

    const firstSave = store.saveGeneralTransaction({
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 12_000,
      transactionAt: "2026-08-12T20:30:00+09:00",
      categoryId: "food",
    })
    const duplicateSave = await store.saveGeneralTransaction({
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 12_000,
      transactionAt: "2026-08-12T20:30:00+09:00",
      categoryId: "food",
    })
    const result = await firstSave

    expect(duplicateSave).toEqual({ status: "error" })
    expect(result).toEqual({
      status: "saved",
      transactionId: "transaction-new",
    })
    expect(repository.saveTransaction).toHaveBeenCalledOnce()
    expect(repository.load).toHaveBeenCalledTimes(2)
    expect(store.transactionMutationState).toBe("idle")
  })

  it("preserves the loaded month and exposes an error when saving fails", async () => {
    const data = createReadyFinanceData()
    data.transactions = [
      createTransaction("expense-1", "ledger-1", "expense", 12_000, 10),
    ]
    const repository = createRepository(data)
    repository.saveTransaction.mockRejectedValueOnce(
      new Error("network unavailable"),
    )
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    const result = await store.saveGeneralTransaction({
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 20_000,
      transactionAt: "2026-08-12T20:30:00+09:00",
      categoryId: "food",
    })

    expect(result).toEqual({ status: "error" })
    expect(store.monthTransactions).toHaveLength(1)
    expect(store.transactionMutationErrorMessage).toBe(
      "네트워크 연결이 원활하지 않아 저장 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요. 입력 내용은 그대로 유지됩니다.",
    )
    expect(store.transactionMutationErrorMessage).not.toContain(
      "network unavailable",
    )
    expect(store.transactionMutationState).toBe("idle")
  })

  it("aborts a delayed save and returns to a retryable state", async () => {
    vi.useFakeTimers()
    const repository = createRepository()
    let saveSignal: AbortSignal | undefined
    repository.saveTransaction.mockImplementationOnce(
      (_userId, _input, options) => {
        saveSignal = options?.signal
        return new Promise<string>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          )
        })
      },
    )
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    const input: RemoteTransactionInput = {
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 20_000,
      transactionAt: "2026-08-12T20:30:00+09:00",
      categoryId: "food",
    }
    const firstSave = store.saveGeneralTransaction(input)

    expect(store.transactionMutationState).toBe("saving")
    await vi.advanceTimersByTimeAsync(15_000)

    expect(await firstSave).toEqual({ status: "error" })
    expect(saveSignal?.aborted).toBe(true)
    expect(store.transactionMutationState).toBe("idle")
    expect(store.transactionMutationErrorMessage).toBe(
      "네트워크 응답이 지연되어 저장 결과를 확인하지 못했습니다. 연결 상태와 거래 목록을 확인한 뒤 다시 시도해 주세요. 입력 내용은 그대로 유지됩니다.",
    )

    repository.saveTransaction.mockResolvedValueOnce("transaction-retry")

    await expect(store.saveGeneralTransaction(input)).resolves.toEqual({
      status: "saved",
      transactionId: "transaction-retry",
    })
    expect(repository.saveTransaction).toHaveBeenCalledTimes(2)
  })

  it("hides mutations from viewers and rejects a write defensively", async () => {
    const data = createReadyFinanceData()
    data.ledgers[0] = { ...data.ledgers[0]!, role: "viewer" }
    const repository = createRepository(data)
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    const result = await store.saveGeneralTransaction({
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 20_000,
      transactionAt: "2026-08-12T20:30:00+09:00",
      categoryId: "food",
    })

    expect(store.canMutateCurrentLedger).toBe(false)
    expect(result).toEqual({ status: "error" })
    expect(repository.saveTransaction).not.toHaveBeenCalled()
  })

  it("deletes only a regular transaction and refreshes the current month", async () => {
    const data = createReadyFinanceData()
    data.transactions = [
      createTransaction("expense-1", "ledger-1", "expense", 12_000, 10),
    ]
    const repository = createRepository(data)
    const store = new MobileAppStore(repository, createAuthGateway())
    await store.initializeAuth()

    const deleted = await store.deleteGeneralTransaction("expense-1")

    expect(deleted).toBe(true)
    expect(repository.softDeleteTransaction).toHaveBeenCalledWith(
      "expense-1",
      "user-1",
    )
    expect(repository.load).toHaveBeenCalledTimes(2)
  })

  it("ignores an older month response that finishes after the latest request", async () => {
    const repository = createRepository()
    const store = new MobileAppStore(
      repository,
      createAuthGateway(),
      new Date("2026-08-10T12:00:00+09:00"),
    )
    await store.initializeAuth()
    const julyData = createReadyFinanceData()
    julyData.profile.nickname = "7월 응답"
    const juneData = createReadyFinanceData()
    juneData.profile.nickname = "6월 응답"
    const julyRequestResult = createDeferred<FinanceData>()
    const juneRequestResult = createDeferred<FinanceData>()
    repository.load
      .mockImplementationOnce(() => julyRequestResult.promise)
      .mockImplementationOnce(() => juneRequestResult.promise)

    const julyRequest = store.moveSelectedMonth(-1)
    await vi.waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2))
    const juneRequest = store.moveSelectedMonth(-1)
    await vi.waitFor(() => expect(repository.load).toHaveBeenCalledTimes(3))

    juneRequestResult.resolve(juneData)
    await juneRequest
    julyRequestResult.resolve(julyData)
    await julyRequest

    expect(store.selectedMonth).toBe("2026-06")
    expect(store.financeData.profile.nickname).toBe("6월 응답")
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function createTransaction(
  id: string,
  ledgerId: string,
  type: "expense" | "income" | "saving",
  amount: number,
  day: number,
) {
  const date = `2026-08-${String(day).padStart(2, "0")}T12:00:00+09:00`
  return {
    id,
    ledgerId,
    type,
    status: "confirmed" as const,
    amount,
    currency: "KRW" as const,
    transactionAt: date,
    sourceType: "manual" as const,
    createdAt: date,
    updatedAt: date,
  }
}

function createExpenseCategory() {
  return {
    color: "#238276",
    icon: "food",
    id: "category-1",
    isArchived: false,
    isDefault: true,
    ledgerId: "ledger-1",
    name: "식비",
    sortOrder: 1,
    type: "expense" as const,
    usageTypes: ["expense" as const],
  }
}

function mockCapturedNotification(): void {
  vi.mocked(getNotificationCaptureStatus).mockResolvedValue({
    ...emptyNotificationStatus,
    allowedPackageNames: ["com.lotte"],
    disclosureAcceptedAt: Date.now(),
    hasDisclosureConsent: true,
    hasNotificationAccess: true,
    isCollectionEnabled: true,
    storedRecordCount: 1,
    targetLedgerId: "ledger-1",
  })
  vi.mocked(readStoredNotificationRecords).mockResolvedValue([
    {
      capturedAt: Date.now(),
      expandedText: "45,000원 승인\n쇼핑엔 로카(8*3*)\n08/13 14:00",
      id: "a".repeat(64),
      receivedAt: Date.now(),
      sourcePackageName: "com.lotte",
      text: "45,000원 승인",
      title: "테스트주유소",
    },
  ])
}
