import {
  createTransactionRequestId,
  createEmptyFinanceData,
  DuplicateTransactionSourceError,
  SupabaseFinanceRepository,
  type AuthSessionEvent,
  type AuthSessionInfo,
  type AuthUserInfo,
  type AcceptLedgerInviteResult,
  type CreatedLedgerInvitation,
  type FinanceData,
  type FinanceLoadOptions,
  type RemoteTransactionInput,
  type TransactionData,
  type TransactionDateRange,
} from "@salimon/api-client"
import {
  findOtherCategory,
  getDescendantCategoryIds,
  getCategoryDepth,
  isSplitCategory,
  MAX_CATEGORY_DEPTH,
  moveMonth,
  toDateKey,
  toMonthKey,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  type Category,
  type CategoryUsageType,
  type InstallmentDeleteScope,
  type Ledger,
  type LedgerRole,
  type LedgerType,
  type LocalSmsCandidate,
  type PaymentInstrument,
  type Transaction,
} from "@salimon/types"
import { makeAutoObservable, runInAction } from "mobx"
import {
  createMobileAuthGateway,
  type MobileAuthGateway,
} from "../features/auth/mobileAuth"
import {
  buildMonthDaySummaries,
  calculateConfirmedTotals,
  type DashboardTransactionGrouping,
  type DashboardTransactionRecurrenceKey,
  type MonthDaySummary,
  type TransactionTotals,
} from "../features/dashboard/dashboardPresentation"
import { createCandidateFromNotificationRecord } from "../features/notification-inbox/notificationInbox"
import {
  isRetryableCandidateRegistrationError,
  validateCandidateRegistrationDraft,
  type CandidateRegistrationDraft,
} from "../features/notification-inbox/candidateRegistration"
import { QueryCache } from "../infrastructure/queryCache"
import { requireSupabaseMobileClient } from "../infrastructure/supabase"
import {
  acceptNotificationDisclosure,
  clearNotificationCaptureSession,
  configureNotificationCapture,
  deleteAllStoredNotificationRecords,
  deleteExpiredNotificationRecords,
  deleteStoredNotificationRecord,
  getNotificationCaptureStatus,
  openNotificationAccessSettings,
  readStoredNotificationRecords,
  revokeNotificationDisclosure,
  setAuthenticatedNotificationCaptureUser,
  saveStoredNotificationRegistrationState,
  type NotificationCaptureStatus,
} from "../native/notificationListener"

type MobileFinanceRepository = Pick<
  SupabaseFinanceRepository,
  | "acceptLegalTerms"
  | "acceptInvite"
  | "archiveCategory"
  | "archiveLedger"
  | "convertPersonalLedgerToShared"
  | "createAccount"
  | "createCard"
  | "createCategory"
  | "createInvite"
  | "createLedger"
  | "deactivateFixedRule"
  | "deleteAccount"
  | "deleteCard"
  | "deleteInstallmentOccurrences"
  | "leaveSharedLedger"
  | "load"
  | "loadMonth"
  | "loadTransactions"
  | "findTransactionRequest"
  | "importTransactions"
  | "removeLedgerMember"
  | "requestAccountDeletion"
  | "renameLedger"
  | "restoreLedger"
  | "revokeInvite"
  | "cancelAccountDeletion"
  | "saveTransaction"
  | "saveMonthNote"
  | "setAccountActive"
  | "setCardActive"
  | "setCategoryBudget"
  | "setDefaultLedger"
  | "softDeleteTransaction"
  | "syncMyLedgerPaymentMethods"
  | "transferLedgerOwnership"
  | "updateAccount"
  | "updateCard"
  | "updateCategory"
  | "updateCategoryOrder"
  | "updateMonthlySummaryVisibility"
  | "updateLedgerMemberRole"
>

export type MobileAuthState =
  | "checking"
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "signingOut"

export type MobileDataStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "ready"
  | "stale"
  | "error"
export type MobileConsentStatus = "idle" | "saving" | "error"
export type MobileTransactionMutationState = "idle" | "saving" | "deleting"
export type MobileManagementMutationState = "idle" | "saving"
export type MobileDataToolState = "idle" | "working"
export type MobileTransactionSearchStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
export type NotificationInboxStatus = "idle" | "loading" | "ready" | "error"
export type NotificationRegistrationState = "idle" | "saving"

type MobileImportedTransaction = Pick<
  Transaction,
  | "type"
  | "status"
  | "amount"
  | "transactionAt"
  | "categoryId"
  | "paymentMethodId"
  | "merchantName"
  | "memo"
  | "actorUserId"
  | "tags"
>

export type MobileTransactionSaveResult =
  | { status: "saved"; transactionId?: string }
  | { status: "error" }

export type NotificationCandidateRegistrationResult =
  | { status: "saved"; transactionId: string }
  | { status: "already_registered" }
  | { status: "pending" }
  | { status: "error" }

const TRANSACTION_SAVE_TIMEOUT_MS = 15_000
const TRANSACTION_SAVE_TIMEOUT_MESSAGE =
  "네트워크 응답이 지연되어 저장 결과를 확인하지 못했습니다. 연결 상태와 거래 목록을 확인한 뒤 다시 시도해 주세요. 입력 내용은 그대로 유지됩니다."

class TransactionSaveTimeoutError extends Error {
  constructor() {
    super(TRANSACTION_SAVE_TIMEOUT_MESSAGE)
    this.name = "TransactionSaveTimeoutError"
  }
}

export interface MobileCategoryBudgetProgress {
  amount: number
  category: Category
  spent: number
}

export interface MobileCategoryInput {
  color: string
  icon: string
  name: string
  parentCategoryId?: string
  usageTypes: CategoryUsageType[]
}

export interface MobileCardInput {
  billingPeriodEndDay: number
  billingPeriodEndMonthOffset: -1 | 0
  isDebit: boolean
  issuer: string
  last4?: string
  name: string
  paymentDay: number
}

export interface MobileAccountInput {
  bank: string
  last4?: string
  name: string
}

export interface MobileLedgerCreationInput {
  ledgerVisibleInstrumentIds: string[]
  name: string
  paymentInstrumentIds: string[]
  setDefault: boolean
  type: LedgerType
}

export class MobileAppStore {
  selectedDate: string
  selectedLedgerId = ""
  selectedMonth: string
  dashboardTransactionGrouping: DashboardTransactionGrouping = "actor"
  collapsedDashboardTransactionGroupKeys =
    new Set<DashboardTransactionRecurrenceKey>()
  authState: MobileAuthState = "checking"
  authUser?: AuthUserInfo
  financeData: FinanceData = createEmptyFinanceData()
  dataStatus: MobileDataStatus = "idle"
  consentStatus: MobileConsentStatus = "idle"
  transactionMutationState: MobileTransactionMutationState = "idle"
  managementMutationState: MobileManagementMutationState = "idle"
  dataToolState: MobileDataToolState = "idle"
  transactionSearchStatus: MobileTransactionSearchStatus = "idle"
  transactionSearchTransactions?: Transaction[]
  transactionSearchSplits?: FinanceData["transactionSplits"]
  transactionSearchRangeKey?: string
  notificationCaptureStatus: NotificationCaptureStatus =
    createEmptyNotificationCaptureStatus()
  notificationCandidates: LocalSmsCandidate[] = []
  notificationInboxStatus: NotificationInboxStatus = "idle"
  notificationRegistrationState: NotificationRegistrationState = "idle"
  profilePreferenceMutationState: "idle" | "saving" = "idle"
  authErrorMessage?: string
  dataErrorMessage?: string
  consentErrorMessage?: string
  transactionMutationErrorMessage?: string
  managementErrorMessage?: string
  managementNoticeMessage?: string
  dataToolErrorMessage?: string
  dataToolNoticeMessage?: string
  transactionSearchErrorMessage?: string
  notificationInboxErrorMessage?: string
  notificationInboxNoticeMessage?: string
  notificationRegistrationErrorMessage?: string

  private activeSessionUserId?: string
  private dataRequestSequence = 0
  private transactionSearchSequence = 0
  private readonly financeQueryCache: QueryCache<FinanceData>
  private readonly prefetchAdjacentMonths: boolean
  private readonly prefetchingMonths = new Set<string>()
  private financeCacheGeneration = 0
  private sessionSequence = 0
  private activationPromise?: Promise<void>

  constructor(
    private readonly repository: MobileFinanceRepository,
    private readonly authGateway: MobileAuthGateway,
    now = new Date(),
    financeQueryCache = new QueryCache<FinanceData>(),
    prefetchAdjacentMonths = false,
  ) {
    this.selectedMonth = toMonthKey(now)
    this.selectedDate = toDateKey(now)
    this.financeQueryCache = financeQueryCache
    this.prefetchAdjacentMonths = prefetchAdjacentMonths
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get requiresLegalConsent(): boolean {
    const consent = this.financeData.legalConsent
    return (
      this.hasLoadedFinanceData &&
      (consent?.termsVersion !== CURRENT_TERMS_VERSION ||
        consent.privacyVersion !== CURRENT_PRIVACY_VERSION)
    )
  }

  get hasLoadedFinanceData(): boolean {
    return (
      this.dataStatus === "ready" ||
      this.dataStatus === "refreshing" ||
      this.dataStatus === "stale"
    )
  }

  get selectableLedgers(): Ledger[] {
    const defaultLedgerId = this.financeData.members.find(
      (member) => member.userId === this.authUser?.id && member.isDefault,
    )?.ledgerId
    const activeLedgers = this.financeData.ledgers.filter(
      (ledger) => !ledger.archivedAt,
    )

    return activeLedgers.sort((first, second) => {
      if (first.id === defaultLedgerId) return -1
      if (second.id === defaultLedgerId) return 1
      return first.name.localeCompare(second.name, "ko-KR")
    })
  }

  get currentLedger(): Ledger | undefined {
    return this.selectableLedgers.find(
      (ledger) => ledger.id === this.selectedLedgerId,
    )
  }

  get currentMembership() {
    return this.financeData.members.find(
      (member) =>
        member.ledgerId === this.selectedLedgerId &&
        member.userId === this.authUser?.id &&
        member.status === "active",
    )
  }

  get currentMembers() {
    return this.financeData.members.filter(
      (member) =>
        member.ledgerId === this.selectedLedgerId && member.status === "active",
    )
  }

  get currentCategories(): Category[] {
    return this.financeData.categories
      .filter((category) => category.ledgerId === this.selectedLedgerId)
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder ||
          first.name.localeCompare(second.name, "ko-KR"),
      )
  }

  get myPaymentInstruments(): PaymentInstrument[] {
    return this.financeData.paymentInstruments
      .filter(
        (instrument) =>
          instrument.ownerUserId === this.authUser?.id && !instrument.isDeleted,
      )
      .sort((first, second) => first.name.localeCompare(second.name, "ko-KR"))
  }

  get currentPaymentMethods() {
    return this.financeData.paymentMethods.filter(
      (method) => method.ledgerId === this.selectedLedgerId,
    )
  }

  get archivedOwnedLedgers(): Ledger[] {
    return this.financeData.ledgers.filter(
      (ledger) => ledger.ownerId === this.authUser?.id && ledger.archivedAt,
    )
  }

  get defaultLedgerId(): string {
    const configuredLedgerId = this.financeData.members.find(
      (member) =>
        member.userId === this.authUser?.id &&
        member.status === "active" &&
        member.isDefault,
    )?.ledgerId
    const configuredLedger = this.selectableLedgers.find(
      (ledger) => ledger.id === configuredLedgerId && ledger.role !== "viewer",
    )

    return (
      configuredLedger?.id ??
      this.selectableLedgers.find((ledger) => ledger.role !== "viewer")?.id ??
      ""
    )
  }

  get currentLedgerName(): string {
    return this.currentLedger?.name ?? "내 가계부"
  }

  get notificationCandidateCount(): number {
    return this.notificationCandidates.length
  }

  get notificationTargetLedgerId(): string {
    const configuredLedgerId = this.notificationCaptureStatus.targetLedgerId
    return this.selectableLedgers.some(
      (ledger) => ledger.id === configuredLedgerId,
    )
      ? configuredLedgerId
      : this.defaultLedgerId
  }

  get selectedMonthNote() {
    return this.financeData.monthNotes.find(
      (note) =>
        note.ledgerId === this.selectedLedgerId &&
        note.month === this.selectedMonth,
    )
  }

  get canMutateCurrentLedger(): boolean {
    return (
      this.dataStatus !== "stale" &&
      this.dataStatus !== "error" &&
      Boolean(this.currentLedger) &&
      this.currentLedger?.role !== "viewer"
    )
  }

  get monthTransactions(): Transaction[] {
    return this.financeData.transactions
      .filter(
        (transaction) =>
          transaction.ledgerId === this.selectedLedgerId &&
          !transaction.deletedAt &&
          toMonthKey(new Date(transaction.transactionAt)) ===
            this.selectedMonth,
      )
      .sort(
        (first, second) =>
          new Date(second.transactionAt).getTime() -
          new Date(first.transactionAt).getTime(),
      )
  }

  get selectedDateTransactions(): Transaction[] {
    return this.monthTransactions.filter(
      (transaction) =>
        toDateKey(new Date(transaction.transactionAt)) === this.selectedDate,
    )
  }

  get monthTotals(): TransactionTotals {
    return calculateConfirmedTotals(this.monthTransactions)
  }

  get monthlySummaryVisible(): boolean {
    return this.financeData.profile.monthlySummaryVisible
  }

  get monthDaySummaries(): MonthDaySummary[] {
    return buildMonthDaySummaries(this.selectedMonth, this.monthTransactions)
  }

  get selectedMonthBudgets(): MobileCategoryBudgetProgress[] {
    const ledgerCategories = this.financeData.categories.filter(
      (category) => category.ledgerId === this.selectedLedgerId,
    )
    const expenseCategories = ledgerCategories.filter(
      (category) =>
        !category.isArchived && category.usageTypes.includes("expense"),
    )

    return expenseCategories.flatMap((category) => {
      const budget = this.financeData.categoryBudgets
        .filter(
          (item) =>
            item.categoryId === category.id &&
            item.effectiveMonth <= this.selectedMonth,
        )
        .sort((first, second) =>
          second.effectiveMonth.localeCompare(first.effectiveMonth),
        )[0]
      if (!budget || budget.amount <= 0) return []

      const categoryIds = getDescendantCategoryIds(
        ledgerCategories,
        category.id,
      )
      const spent = this.monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.status === "confirmed",
        )
        .reduce(
          (sum, transaction) =>
            sum +
            transactionAmountForCategoryIds(
              transaction,
              this.financeData.transactionSplits,
              categoryIds,
            ),
          0,
        )

      return [{ amount: budget.amount, category, spent }]
    })
  }

  async initializeAuth(): Promise<void> {
    this.authState = "checking"
    this.authErrorMessage = undefined

    try {
      const session = await this.authGateway.getCurrentSession()
      if (!session) {
        await this.safelyClearNotificationCaptureSession()
        this.resetSession()
        return
      }
      await this.activateSession(session)
    } catch (error) {
      await this.rejectSession(error)
    }
  }

  observeAuthSession(): () => void {
    return this.authGateway.observe(this.handleAuthEvent)
  }

  bindSessionRefresh(): () => void {
    return this.authGateway.bindSessionRefresh()
  }

  async loginWithKakao(): Promise<void> {
    if (this.authState === "authenticating") return

    this.authState = "authenticating"
    this.authErrorMessage = undefined

    try {
      const result = await this.authGateway.loginWithKakao()
      if (result.status === "cancelled") {
        runInAction(() => {
          this.authState = "anonymous"
        })
        return
      }
      await this.activateSession(result.session)
    } catch (error) {
      runInAction(() => {
        this.authState = "anonymous"
        this.authErrorMessage = errorMessage(
          error,
          "카카오 로그인에 실패했습니다.",
        )
      })
    }
  }

  async completeAuthCallback(url: string): Promise<void> {
    this.authState = "authenticating"
    this.authErrorMessage = undefined

    try {
      const session = await this.authGateway.completeCallbackUrl(url)
      await this.activateSession(session)
    } catch (error) {
      try {
        const restoredSession = await this.authGateway.getCurrentSession()
        if (restoredSession) {
          await this.activateSession(restoredSession)
          return
        }
      } catch {
        // 콜백 오류를 유지하고 아래에서 안전하게 로그인 상태를 초기화한다.
      }
      await this.rejectSession(error)
    }
  }

  async logout(): Promise<void> {
    if (this.authState === "signingOut") return

    this.authState = "signingOut"
    this.authErrorMessage = undefined
    let logoutError: unknown

    try {
      await clearNotificationCaptureSession()
    } catch (error) {
      logoutError = error
    }

    try {
      await this.authGateway.signOut()
    } catch (error) {
      logoutError = error
      try {
        await this.authGateway.clearLocalSession()
      } catch (localError) {
        logoutError = localError
      }
    }

    runInAction(() => {
      this.resetSession()
      if (logoutError) {
        this.authErrorMessage = errorMessage(
          logoutError,
          "로그아웃 중 오류가 발생했습니다. 앱을 다시 시작해 주세요.",
        )
      }
    })
  }

  async loadSelectedMonth(
    month = this.selectedMonth,
    forceRefresh = false,
    reloadMetadata = false,
  ): Promise<void> {
    const userId = this.authUser?.id
    if (!userId) return

    const sequence = this.sessionSequence
    const requestSequence = ++this.dataRequestSequence
    const cacheKey = createFinanceCacheKey(userId, month)
    const cached = this.financeQueryCache.get(cacheKey)
    const transactionDateRange = createKoreaMonthTransactionRange(month)
    const options: FinanceLoadOptions = { transactionDateRange }
    const canReuseMetadata =
      !reloadMetadata && this.financeData.profile.id === userId
    const baseFinanceData = cached?.data ?? this.financeData

    this.selectedMonth = month
    this.ensureSelectedDateBelongsToMonth(month)
    this.dataErrorMessage = undefined

    if (cached?.isFresh && !forceRefresh) {
      this.applyFinanceData(cached.data)
      this.dataStatus = "ready"
      this.scheduleAdjacentMonthPrefetch(month, userId, cached.data)
      return
    }

    if (cached) {
      this.applyFinanceData(cached.data)
      this.dataStatus = "refreshing"
    } else if (canReuseMetadata) {
      this.dataStatus = "refreshing"
    } else {
      this.dataStatus = "loading"
    }

    try {
      let financeData: FinanceData
      if (canReuseMetadata) {
        financeData = mergeFinanceTransactionData(
          baseFinanceData,
          await this.repository.loadTransactions(transactionDateRange),
        )
      } else {
        financeData = await this.repository.loadMonth(userId, month, options)
      }

      if (financeData.ledgers.length === 0) {
        await this.repository.createLedger({
          name: "내 가계부",
          type: "personal",
          setDefault: true,
          paymentInstrumentIds: [],
          ledgerVisibleInstrumentIds: [],
        })
        financeData = await this.repository.loadMonth(userId, month, options)
      }

      if (
        sequence !== this.sessionSequence ||
        requestSequence !== this.dataRequestSequence ||
        userId !== this.authUser?.id
      ) {
        return
      }

      runInAction(() => {
        this.applyFinanceData(financeData)
        this.financeQueryCache.set(cacheKey, financeData)
        this.dataStatus = "ready"
      })
      this.scheduleAdjacentMonthPrefetch(month, userId, financeData)
    } catch (error) {
      if (
        sequence !== this.sessionSequence ||
        requestSequence !== this.dataRequestSequence ||
        userId !== this.authUser?.id
      ) {
        return
      }

      runInAction(() => {
        const message = dataLoadErrorMessage(
          error,
          "가계부 데이터를 불러오지 못했습니다.",
        )
        if (cached) {
          this.applyFinanceData(cached.data)
          this.dataStatus = "stale"
          this.dataErrorMessage = `${message} 마지막 조회 내용을 읽기 전용으로 표시합니다.`
        } else if (canReuseMetadata) {
          this.dataStatus = "stale"
          this.dataErrorMessage = `${message} 월 화면은 유지하며 읽기 전용으로 표시합니다.`
        } else {
          this.dataStatus = "error"
          this.dataErrorMessage = message
        }
      })
    }
  }

  async refreshSelectedMonth(): Promise<void> {
    await this.loadSelectedMonth(this.selectedMonth, true)
  }

  private scheduleAdjacentMonthPrefetch(
    month: string,
    userId: string,
    baseFinanceData: FinanceData,
  ): void {
    if (!this.prefetchAdjacentMonths) return

    for (const offset of [-1, 1] as const) {
      const adjacentMonth = moveMonth(month, offset)
      const cacheKey = createFinanceCacheKey(userId, adjacentMonth)
      if (
        this.financeQueryCache.get(cacheKey)?.isFresh ||
        this.prefetchingMonths.has(cacheKey)
      ) {
        continue
      }

      this.prefetchingMonths.add(cacheKey)
      void this.prefetchMonth(
        adjacentMonth,
        userId,
        baseFinanceData,
        cacheKey,
        this.financeCacheGeneration,
      )
    }
  }

  private async prefetchMonth(
    month: string,
    userId: string,
    baseFinanceData: FinanceData,
    cacheKey: string,
    cacheGeneration: number,
  ): Promise<void> {
    const sequence = this.sessionSequence
    try {
      const transactionData = await this.repository.loadTransactions(
        createKoreaMonthTransactionRange(month),
      )
      if (
        sequence !== this.sessionSequence ||
        userId !== this.authUser?.id ||
        cacheGeneration !== this.financeCacheGeneration
      ) {
        return
      }
      this.financeQueryCache.set(
        cacheKey,
        mergeFinanceTransactionData(baseFinanceData, transactionData),
      )
    } catch {
      // 인접 월 사전 로딩 실패는 현재 화면을 방해하지 않는다.
    } finally {
      this.prefetchingMonths.delete(cacheKey)
    }
  }

  async loadTransactionSearchRange(
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const userId = this.authUser?.id
    if (!userId || !isDateKey(startDate) || !isDateKey(endDate)) return
    if (endDate < startDate) {
      this.transactionSearchStatus = "error"
      this.transactionSearchErrorMessage =
        "검색 종료일은 시작일보다 빠를 수 없습니다."
      return
    }

    const sequence = ++this.transactionSearchSequence
    this.transactionSearchStatus = "loading"
    this.transactionSearchRangeKey = `${startDate}:${endDate}`
    this.transactionSearchErrorMessage = undefined
    try {
      const transactionData = await this.repository.loadTransactions(
        createKoreaTransactionDateRange(startDate, endDate),
      )
      if (sequence !== this.transactionSearchSequence) return
      runInAction(() => {
        this.transactionSearchTransactions = transactionData.transactions
        this.transactionSearchSplits = transactionData.transactionSplits
        this.transactionSearchStatus = "ready"
      })
    } catch (error) {
      if (sequence !== this.transactionSearchSequence) return
      runInAction(() => {
        this.transactionSearchStatus = "error"
        this.transactionSearchErrorMessage = dataLoadErrorMessage(
          error,
          "선택한 기간의 거래를 불러오지 못했습니다.",
        )
      })
    }
  }

  clearTransactionSearchRange(): void {
    this.transactionSearchSequence += 1
    this.transactionSearchStatus = "idle"
    this.transactionSearchTransactions = undefined
    this.transactionSearchSplits = undefined
    this.transactionSearchRangeKey = undefined
    this.transactionSearchErrorMessage = undefined
  }

  clearTransactionMutationError(): void {
    this.transactionMutationErrorMessage = undefined
  }

  async saveGeneralTransaction(
    input: RemoteTransactionInput,
  ): Promise<MobileTransactionSaveResult> {
    if (this.transactionMutationState !== "idle") {
      return { status: "error" }
    }
    if (
      !this.authUser ||
      !this.canMutateCurrentLedger ||
      input.ledgerId !== this.selectedLedgerId
    ) {
      this.transactionMutationErrorMessage =
        "현재 가계부에서 거래를 저장할 권한이 없습니다."
      return { status: "error" }
    }

    this.transactionMutationState = "saving"
    this.transactionMutationErrorMessage = undefined

    const userId = this.authUser.id
    const requestInput =
      input.id || input.requestId
        ? input
        : { ...input, requestId: createTransactionRequestId() }
    const abortController = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      let transactionId: string | undefined
      try {
        transactionId = await Promise.race([
          this.repository.saveTransaction(userId, requestInput, {
            signal: abortController.signal,
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new TransactionSaveTimeoutError())
              abortController.abort()
            }, TRANSACTION_SAVE_TIMEOUT_MS)
          }),
        ])
      } catch (error) {
        if (
          !(error instanceof TransactionSaveTimeoutError) ||
          !requestInput.requestId
        ) {
          throw error
        }
        const recovered = await this.repository.findTransactionRequest(
          requestInput.requestId,
        )
        if (!recovered.transactionId && !recovered.recurringRuleId) {
          throw error
        }
        transactionId = recovered.transactionId ?? recovered.recurringRuleId
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      const savedTransactionId = requestInput.recurringType
        ? requestInput.id
        : (transactionId ?? requestInput.id ?? requestInput.requestId)
      const transactionMonth = toMonthKey(new Date(requestInput.transactionAt))

      runInAction(() => {
        this.selectedDate = toDateKey(new Date(requestInput.transactionAt))
        this.selectedMonth = transactionMonth
        this.ensureSelectedDateBelongsToMonth(transactionMonth)
        this.invalidateFinanceQueryCache()
        if (savedTransactionId) {
          this.applyOptimisticTransaction(
            savedTransactionId,
            requestInput,
            userId,
          )
        }
        this.clearTransactionSearchRange()
        this.transactionMutationState = "idle"
      })
      void this.loadSelectedMonth(transactionMonth, true)
      return savedTransactionId
        ? { status: "saved", transactionId: savedTransactionId }
        : { status: "saved" }
    } catch (error) {
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.transactionMutationErrorMessage =
          error instanceof TransactionSaveTimeoutError
            ? TRANSACTION_SAVE_TIMEOUT_MESSAGE
            : mutationErrorMessage(
                error,
                input.id
                  ? "거래를 수정하지 못했습니다. 입력 내용은 그대로 유지됩니다."
                  : "거래를 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다.",
              )
      })
      return { status: "error" }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  async deleteGeneralTransaction(transactionId: string): Promise<boolean> {
    if (this.transactionMutationState !== "idle") return false

    const transaction = [
      ...this.financeData.transactions,
      ...(this.transactionSearchTransactions ?? []),
    ].find((item) => item.id === transactionId && !item.deletedAt)
    if (
      !this.authUser ||
      !this.canMutateCurrentLedger ||
      !transaction ||
      transaction.ledgerId !== this.selectedLedgerId ||
      transaction.recurringType ||
      transaction.recurringRuleId
    ) {
      this.transactionMutationErrorMessage =
        "이 거래는 일반 삭제 방식으로 처리할 수 없습니다."
      return false
    }

    this.transactionMutationState = "deleting"
    this.transactionMutationErrorMessage = undefined

    try {
      await this.repository.softDeleteTransaction(
        transactionId,
        this.authUser.id,
      )
      this.clearTransactionSearchRange()
      await this.loadSelectedMonth(
        toMonthKey(new Date(transaction.transactionAt)),
        true,
      )
      runInAction(() => {
        this.transactionMutationState = "idle"
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.transactionMutationErrorMessage = errorMessage(
          error,
          "거래를 삭제하지 못했습니다.",
        )
      })
      return false
    }
  }

  async endFixedRule(
    ruleId: string,
    timing: "current" | "next" = "current",
    month = this.selectedMonth,
  ): Promise<boolean> {
    if (
      !this.canMutateCurrentLedger ||
      this.transactionMutationState !== "idle"
    ) {
      return false
    }
    this.transactionMutationState = "deleting"
    this.transactionMutationErrorMessage = undefined
    try {
      await this.repository.deactivateFixedRule(
        ruleId,
        timing === "current" ? month : moveMonth(month, 1),
      )
      this.clearTransactionSearchRange()
      await this.loadSelectedMonth(month, true)
      runInAction(() => {
        this.transactionMutationState = "idle"
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.transactionMutationErrorMessage = errorMessage(
          error,
          "고정 거래를 종료하지 못했습니다.",
        )
      })
      return false
    }
  }

  async deleteInstallmentOccurrences(
    ruleId: string,
    installmentNumber: number,
    scope: InstallmentDeleteScope,
    month = this.selectedMonth,
  ): Promise<boolean> {
    if (
      !this.canMutateCurrentLedger ||
      this.transactionMutationState !== "idle"
    ) {
      return false
    }
    this.transactionMutationState = "deleting"
    this.transactionMutationErrorMessage = undefined
    try {
      await this.repository.deleteInstallmentOccurrences(
        ruleId,
        installmentNumber,
        scope,
      )
      this.clearTransactionSearchRange()
      await this.loadSelectedMonth(month, true)
      runInAction(() => {
        this.transactionMutationState = "idle"
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.transactionMutationErrorMessage = errorMessage(
          error,
          "할부 거래를 삭제하지 못했습니다.",
        )
      })
      return false
    }
  }

  async moveSelectedMonth(amount: number): Promise<void> {
    if (this.transactionMutationState !== "idle") return
    const month = moveMonth(this.selectedMonth, amount)
    this.selectedDate = `${month}-01`
    await this.loadSelectedMonth(month)
  }

  selectLedger(ledgerId: string): void {
    if (!this.selectableLedgers.some((ledger) => ledger.id === ledgerId)) {
      return
    }
    this.selectedLedgerId = ledgerId
    this.clearTransactionSearchRange()
  }

  selectDate(date: string): void {
    if (this.monthDaySummaries.some((summary) => summary.date === date)) {
      this.selectedDate = date
    }
  }

  async setMonthlySummaryVisibility(visible: boolean): Promise<boolean> {
    if (
      !this.authUser ||
      this.profilePreferenceMutationState !== "idle" ||
      this.financeData.profile.monthlySummaryVisible === visible
    ) {
      return false
    }

    const previous = this.financeData.profile.monthlySummaryVisible
    this.profilePreferenceMutationState = "saving"
    this.financeData.profile.monthlySummaryVisible = visible
    try {
      await this.repository.updateMonthlySummaryVisibility(
        this.authUser.id,
        visible,
      )
      runInAction(() => {
        this.profilePreferenceMutationState = "idle"
        this.invalidateFinanceQueryCache()
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.financeData.profile.monthlySummaryVisible = previous
        this.profilePreferenceMutationState = "idle"
        this.dataErrorMessage = errorMessage(
          error,
          "월 합계 표시 설정을 저장하지 못했습니다.",
        )
      })
      return false
    }
  }

  setDashboardTransactionGrouping(
    grouping: DashboardTransactionGrouping,
  ): void {
    this.dashboardTransactionGrouping = grouping
  }

  toggleDashboardTransactionGroup(
    groupKey: DashboardTransactionRecurrenceKey,
  ): void {
    if (this.collapsedDashboardTransactionGroupKeys.has(groupKey)) {
      this.collapsedDashboardTransactionGroupKeys.delete(groupKey)
      return
    }
    this.collapsedDashboardTransactionGroupKeys.add(groupKey)
  }

  clearManagementFeedback(): void {
    this.managementErrorMessage = undefined
    this.managementNoticeMessage = undefined
  }

  clearDataToolFeedback(): void {
    this.dataToolErrorMessage = undefined
    this.dataToolNoticeMessage = undefined
  }

  async loadFullFinanceDataForExport(): Promise<FinanceData | undefined> {
    if (!this.authUser || this.dataToolState !== "idle") return undefined
    this.dataToolState = "working"
    this.clearDataToolFeedback()
    try {
      const financeData = await this.repository.load(this.authUser.id)
      runInAction(() => {
        this.dataToolState = "idle"
      })
      return financeData
    } catch (error) {
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolErrorMessage = dataLoadErrorMessage(
          error,
          "전체 계정 데이터를 불러오지 못했습니다.",
        )
      })
      return undefined
    }
  }

  async importBackupTransactions(transactions: unknown[]): Promise<number> {
    if (
      !this.authUser ||
      !this.canMutateCurrentLedger ||
      this.dataToolState !== "idle"
    ) {
      this.dataToolErrorMessage =
        "수정 가능한 가계부와 최신 데이터가 필요합니다."
      return 0
    }
    this.dataToolState = "working"
    this.clearDataToolFeedback()
    try {
      const fullData = await this.repository.load(this.authUser.id)
      const existingKeys = new Set(
        fullData.transactions
          .filter(
            (transaction) =>
              transaction.ledgerId === this.selectedLedgerId &&
              !transaction.deletedAt,
          )
          .map(transactionDuplicateKey),
      )
      const categoryIds = new Set(
        this.currentCategories.map((category) => category.id),
      )
      const paymentMethodIds = new Set(
        this.currentPaymentMethods.map((method) => method.id),
      )
      const memberIds = new Set(
        this.currentMembers.map((member) => member.userId),
      )
      const fallbackCategoryId = findOtherCategory(
        this.currentCategories,
        this.selectedLedgerId,
      )?.id
      const valid = transactions
        .map(normalizeImportedTransaction)
        .filter((transaction): transaction is MobileImportedTransaction =>
          Boolean(transaction),
        )
        .filter((transaction) => {
          const key = transactionDuplicateKey(transaction)
          if (existingKeys.has(key)) return false
          existingKeys.add(key)
          return true
        })
        .slice(0, 2_000)
        .map((transaction) => ({
          ...transaction,
          categoryId:
            transaction.categoryId && categoryIds.has(transaction.categoryId)
              ? transaction.categoryId
              : fallbackCategoryId,
          paymentMethodId:
            transaction.paymentMethodId &&
            paymentMethodIds.has(transaction.paymentMethodId)
              ? transaction.paymentMethodId
              : undefined,
          actorUserId:
            transaction.actorUserId && memberIds.has(transaction.actorUserId)
              ? transaction.actorUserId
              : undefined,
        }))

      if (valid.length === 0) {
        runInAction(() => {
          this.dataToolState = "idle"
          this.dataToolNoticeMessage = "복원할 새 거래가 없습니다."
        })
        return 0
      }

      await this.repository.importTransactions(
        this.authUser.id,
        this.selectedLedgerId,
        valid,
      )
      this.invalidateFinanceQueryCache()
      await this.refreshSelectedMonth()
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolNoticeMessage =
          String(valid.length) + "건의 거래를 복원했습니다."
      })
      return valid.length
    } catch (error) {
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolErrorMessage = mutationErrorMessage(
          error,
          "거래를 복원하지 못했습니다.",
        )
      })
      return 0
    }
  }

  async requestAccountDeletion(): Promise<boolean> {
    if (!this.authUser || this.dataToolState !== "idle") return false
    this.dataToolState = "working"
    this.clearDataToolFeedback()
    try {
      const purgeAfter = await this.repository.requestAccountDeletion()
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolNoticeMessage =
          new Date(purgeAfter).toLocaleDateString("ko-KR") +
          "에 계정이 삭제됩니다. 그 전까지 취소할 수 있습니다."
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolErrorMessage = mutationErrorMessage(
          error,
          "계정 삭제를 예약하지 못했습니다.",
        )
      })
      return false
    }
  }

  async cancelAccountDeletion(): Promise<boolean> {
    if (!this.authUser || this.dataToolState !== "idle") return false
    this.dataToolState = "working"
    this.clearDataToolFeedback()
    try {
      await this.repository.cancelAccountDeletion()
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolNoticeMessage = "계정 삭제 요청을 취소했습니다."
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.dataToolState = "idle"
        this.dataToolErrorMessage = mutationErrorMessage(
          error,
          "계정 삭제 요청을 취소하지 못했습니다.",
        )
      })
      return false
    }
  }

  async saveMonthNote(note: string): Promise<boolean> {
    if (!this.canManageCurrentLedger() || note.length > 1_000) {
      this.managementErrorMessage =
        "정산 메모는 수정 가능한 가계부에서 1,000자 이내로 입력해 주세요."
      return false
    }
    return this.runManagementMutation(
      () =>
        this.repository.saveMonthNote(
          this.selectedLedgerId,
          this.selectedMonth,
          note,
          this.selectedMonthNote?.id,
        ),
      "월 정산 메모를 저장했습니다.",
    )
  }

  categoryBudgetAmount(categoryId: string): number {
    return (
      this.financeData.categoryBudgets
        .filter(
          (budget) =>
            budget.categoryId === categoryId &&
            budget.effectiveMonth <= this.selectedMonth,
        )
        .sort((first, second) =>
          second.effectiveMonth.localeCompare(first.effectiveMonth),
        )[0]?.amount ?? 0
    )
  }

  async createCategory(
    input: MobileCategoryInput,
    budgetAmount = 0,
  ): Promise<boolean> {
    const validated = this.validateCategoryInput(input)
    if (!validated || !this.canManageCurrentLedger()) return false

    return this.runManagementMutation(async () => {
      const categoryId = await this.repository.createCategory({
        ledgerId: this.selectedLedgerId,
        ...validated,
      })
      if (validated.usageTypes.includes("expense") && budgetAmount > 0) {
        await this.repository.setCategoryBudget({
          ledgerId: this.selectedLedgerId,
          categoryId,
          month: this.selectedMonth,
          amount: budgetAmount,
          userId: this.authUser!.id,
        })
      }
    }, "카테고리를 추가했습니다.")
  }

  async updateCategory(
    categoryId: string,
    input: MobileCategoryInput,
  ): Promise<boolean> {
    const category = this.currentCategories.find(
      (item) => item.id === categoryId,
    )
    const validated = this.validateCategoryInput(input, categoryId)
    if (!category || !validated || !this.canManageCurrentLedger()) return false

    return this.runManagementMutation(
      () => this.repository.updateCategory(categoryId, validated),
      "카테고리를 수정했습니다.",
    )
  }

  async archiveCategory(categoryId: string): Promise<boolean> {
    const category = this.currentCategories.find(
      (item) => item.id === categoryId,
    )
    if (
      !category ||
      category.isDefault ||
      isSplitCategory(category) ||
      this.currentCategories.some(
        (item) => item.parentCategoryId === categoryId && !item.isArchived,
      ) ||
      !this.canManageCurrentLedger()
    ) {
      this.managementErrorMessage = category?.isDefault
        ? "기본 카테고리는 보관할 수 없습니다."
        : "하위 카테고리를 먼저 이동하거나 보관해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.archiveCategory(categoryId),
      "카테고리를 보관했습니다.",
    )
  }

  async moveCategory(
    categoryId: string,
    direction: "up" | "down",
  ): Promise<boolean> {
    const category = this.currentCategories.find(
      (item) => item.id === categoryId,
    )
    if (!category || !this.canManageCurrentLedger()) return false
    const siblings = this.currentCategories.filter(
      (item) => item.parentCategoryId === category.parentCategoryId,
    )
    const index = siblings.findIndex((item) => item.id === categoryId)
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length)
      return false
    const reordered = [...siblings]
    const [moved] = reordered.splice(index, 1)
    if (!moved) return false
    reordered.splice(targetIndex, 0, moved)
    return this.runManagementMutation(
      () =>
        this.repository.updateCategoryOrder(
          category.parentCategoryId,
          reordered.map((item) => item.id),
        ),
      "카테고리 순서를 변경했습니다.",
    )
  }

  async setCategoryBudget(
    categoryId: string,
    amount: number,
  ): Promise<boolean> {
    const category = this.currentCategories.find(
      (item) => item.id === categoryId,
    )
    if (
      !category ||
      !category.usageTypes.includes("expense") ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      !this.canManageCurrentLedger()
    ) {
      this.managementErrorMessage = "올바른 예산 금액을 입력해 주세요."
      return false
    }
    return this.runManagementMutation(
      () =>
        this.repository.setCategoryBudget({
          ledgerId: this.selectedLedgerId,
          categoryId,
          month: this.selectedMonth,
          amount,
          userId: this.authUser!.id,
        }),
      "카테고리 예산을 저장했습니다.",
    )
  }

  async createCard(input: MobileCardInput): Promise<boolean> {
    const validated = validateCardInput(input)
    if (!validated || !this.authUser) {
      this.managementErrorMessage = "카드 정보를 확인해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.createCard(validated),
      "카드를 등록했습니다. 사용할 가계부에 연결해 주세요.",
    )
  }

  async updateCard(
    instrumentId: string,
    input: MobileCardInput,
  ): Promise<boolean> {
    const validated = validateCardInput(input)
    const instrument = this.myPaymentInstruments.find(
      (item) => item.id === instrumentId && item.type === "card",
    )
    if (!validated || !instrument) {
      this.managementErrorMessage = "카드 정보를 확인해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.updateCard(instrumentId, validated),
      "카드를 수정했습니다.",
    )
  }

  async setCardActive(
    instrumentId: string,
    isActive: boolean,
  ): Promise<boolean> {
    return this.runManagementMutation(
      () => this.repository.setCardActive(instrumentId, isActive),
      isActive ? "카드를 활성화했습니다." : "카드를 비활성화했습니다.",
    )
  }

  async deleteCard(instrumentId: string): Promise<boolean> {
    return this.runManagementMutation(
      () => this.repository.deleteCard(instrumentId),
      "카드를 삭제하고 가계부 연결을 해제했습니다.",
    )
  }

  async createAccount(input: MobileAccountInput): Promise<boolean> {
    const validated = validateAccountInput(input)
    if (!validated || !this.authUser) {
      this.managementErrorMessage = "계좌 정보를 확인해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.createAccount(validated),
      "계좌를 등록했습니다. 사용할 가계부에 연결해 주세요.",
    )
  }

  async updateAccount(
    instrumentId: string,
    input: MobileAccountInput,
  ): Promise<boolean> {
    const validated = validateAccountInput(input)
    const instrument = this.myPaymentInstruments.find(
      (item) => item.id === instrumentId && item.type === "bank",
    )
    if (!validated || !instrument) {
      this.managementErrorMessage = "계좌 정보를 확인해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.updateAccount(instrumentId, validated),
      "계좌를 수정했습니다.",
    )
  }

  async setAccountActive(
    instrumentId: string,
    isActive: boolean,
  ): Promise<boolean> {
    return this.runManagementMutation(
      () => this.repository.setAccountActive(instrumentId, isActive),
      isActive ? "계좌를 활성화했습니다." : "계좌를 비활성화했습니다.",
    )
  }

  async deleteAccount(instrumentId: string): Promise<boolean> {
    return this.runManagementMutation(
      () => this.repository.deleteAccount(instrumentId),
      "계좌를 삭제하고 가계부 연결을 해제했습니다.",
    )
  }

  async syncCurrentLedgerPaymentMethods(
    instrumentIds: string[],
    visibleInstrumentIds: string[],
    primaryInstrumentId?: string,
  ): Promise<boolean> {
    if (!this.currentLedger || this.currentLedger.role === "viewer")
      return false
    return this.runManagementMutation(
      () =>
        this.repository.syncMyLedgerPaymentMethods(
          this.currentLedger!.id,
          instrumentIds,
          this.currentLedger!.type === "shared" ? visibleInstrumentIds : [],
          primaryInstrumentId,
        ),
      "이 가계부의 카드·계좌 연결을 저장했습니다.",
    )
  }

  async createLedger(input: MobileLedgerCreationInput): Promise<boolean> {
    const name = input.name.trim()
    if (!this.authUser || !name || name.length > 30) {
      this.managementErrorMessage = "가계부 이름은 1~30자로 입력해 주세요."
      return false
    }
    let ledgerId: string | undefined
    const succeeded = await this.runManagementMutation(
      async () => {
        ledgerId = await this.repository.createLedger({ ...input, name })
      },
      `${input.type === "shared" ? "공동" : "개인"} 가계부를 만들었습니다.`,
    )
    if (succeeded && ledgerId) this.selectedLedgerId = ledgerId
    return succeeded
  }

  async renameCurrentLedger(name: string): Promise<boolean> {
    const ledger = this.currentLedger
    const trimmed = name.trim()
    const canRename =
      ledger?.type === "personal"
        ? ledger.ownerId === this.authUser?.id
        : ledger?.role === "owner" || ledger?.role === "admin"
    if (!ledger || !canRename || !trimmed || trimmed.length > 30) {
      this.managementErrorMessage =
        "가계부 이름을 변경할 권한이나 올바른 이름이 필요합니다."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.renameLedger(ledger.id, trimmed),
      "가계부 이름을 변경했습니다.",
    )
  }

  async setDefaultLedger(ledgerId: string): Promise<boolean> {
    if (!this.selectableLedgers.some((ledger) => ledger.id === ledgerId))
      return false
    return this.runManagementMutation(
      () => this.repository.setDefaultLedger(ledgerId),
      "기본 가계부를 변경했습니다.",
    )
  }

  async convertCurrentLedgerToShared(): Promise<boolean> {
    const ledger = this.currentLedger
    if (
      !ledger ||
      ledger.type !== "personal" ||
      ledger.ownerId !== this.authUser?.id
    ) {
      return false
    }
    return this.runManagementMutation(
      () => this.repository.convertPersonalLedgerToShared(ledger.id),
      "개인 가계부를 공동 가계부로 전환했습니다.",
    )
  }

  async archiveCurrentLedger(): Promise<boolean> {
    const ledger = this.currentLedger
    if (!ledger || ledger.ownerId !== this.authUser?.id) return false
    if (this.currentMembership?.isDefault) {
      this.managementErrorMessage =
        "다른 가계부를 기본 가계부로 설정한 후 보관해 주세요."
      return false
    }
    return this.runManagementMutation(
      () => this.repository.archiveLedger(ledger.id),
      "가계부를 보관했습니다. 30일 동안 복원할 수 있습니다.",
    )
  }

  async restoreLedger(ledgerId: string): Promise<boolean> {
    if (!this.archivedOwnedLedgers.some((ledger) => ledger.id === ledgerId)) {
      return false
    }
    const succeeded = await this.runManagementMutation(
      () => this.repository.restoreLedger(ledgerId),
      "가계부를 복원했습니다.",
    )
    if (succeeded) this.selectedLedgerId = ledgerId
    return succeeded
  }

  async leaveCurrentSharedLedger(): Promise<boolean> {
    const ledger = this.currentLedger
    if (!ledger || ledger.type !== "shared" || ledger.role === "owner")
      return false
    return this.runManagementMutation(
      () => this.repository.leaveSharedLedger(ledger.id),
      "공동 가계부에서 나왔습니다.",
    )
  }

  async createInvite(
    role: Exclude<LedgerRole, "owner">,
  ): Promise<CreatedLedgerInvitation | undefined> {
    const ledger = this.currentLedger
    if (
      !ledger ||
      ledger.type !== "shared" ||
      (ledger.role !== "owner" && ledger.role !== "admin") ||
      !this.hasLoadedFinanceData ||
      this.dataStatus === "stale" ||
      this.managementMutationState !== "idle"
    ) {
      return undefined
    }
    this.clearManagementFeedback()
    this.managementMutationState = "saving"
    try {
      const invitation = await this.repository.createInvite(ledger.id, role)
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.managementMutationState = "idle"
        this.managementNoticeMessage = "초대 코드를 만들었습니다."
      })
      return invitation
    } catch (error) {
      runInAction(() => {
        this.managementMutationState = "idle"
        this.managementErrorMessage = errorMessage(
          error,
          "초대 코드를 만들지 못했습니다.",
        )
      })
      return undefined
    }
  }

  async revokeInvite(invitationId: string): Promise<boolean> {
    return this.runManagementMutation(
      () => this.repository.revokeInvite(invitationId),
      "초대를 취소했습니다.",
    )
  }

  async acceptInvite(
    inviteCode: string,
  ): Promise<AcceptLedgerInviteResult | undefined> {
    const code = inviteCode.trim().toUpperCase()
    if (
      !code ||
      !this.hasLoadedFinanceData ||
      this.dataStatus === "stale" ||
      this.managementMutationState !== "idle"
    ) {
      return undefined
    }
    this.clearManagementFeedback()
    this.managementMutationState = "saving"
    try {
      const result = await this.repository.acceptInvite(code)
      if (result.status === "invalid_or_expired") {
        runInAction(() => {
          this.managementMutationState = "idle"
          this.managementErrorMessage =
            "유효하지 않거나 만료된 초대 코드입니다."
        })
        return result
      }
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.selectedLedgerId = result.ledgerId
        this.managementMutationState = "idle"
        this.managementNoticeMessage =
          result.status === "already_member"
            ? "이미 참여 중인 가계부로 이동했습니다."
            : "공동 가계부에 참여했습니다."
      })
      return result
    } catch (error) {
      runInAction(() => {
        this.managementMutationState = "idle"
        this.managementErrorMessage = errorMessage(
          error,
          "공동 가계부 초대를 확인하지 못했습니다.",
        )
      })
      return undefined
    }
  }

  async updateMemberRole(
    targetUserId: string,
    role: Exclude<LedgerRole, "owner">,
  ): Promise<boolean> {
    if (this.currentLedger?.role !== "owner") return false
    return this.runManagementMutation(
      () =>
        this.repository.updateLedgerMemberRole(
          this.selectedLedgerId,
          targetUserId,
          role,
        ),
      "멤버 역할을 변경했습니다.",
    )
  }

  async removeMember(targetUserId: string): Promise<boolean> {
    if (this.currentLedger?.role !== "owner") return false
    return this.runManagementMutation(
      () =>
        this.repository.removeLedgerMember(this.selectedLedgerId, targetUserId),
      "멤버를 공동 가계부에서 내보냈습니다.",
    )
  }

  async transferLedgerOwnership(targetUserId: string): Promise<boolean> {
    if (this.currentLedger?.role !== "owner") return false
    return this.runManagementMutation(
      () =>
        this.repository.transferLedgerOwnership(
          this.selectedLedgerId,
          targetUserId,
        ),
      "가계부 소유권을 이전했습니다.",
    )
  }

  private validateCategoryInput(
    input: MobileCategoryInput,
    editingCategoryId?: string,
  ): MobileCategoryInput | undefined {
    const name = input.name.trim()
    const usageTypes = [...new Set(input.usageTypes)]
    const parent = input.parentCategoryId
      ? this.currentCategories.find(
          (category) => category.id === input.parentCategoryId,
        )
      : undefined
    const descendantIds = editingCategoryId
      ? getDescendantCategoryIds(
          this.currentCategories,
          editingCategoryId,
          false,
        )
      : new Set<string>()
    const editingDepth = editingCategoryId
      ? getCategoryDepth(this.currentCategories, editingCategoryId)
      : 1
    const subtreeHeight = editingCategoryId
      ? Math.max(
          1,
          ...[...descendantIds].map(
            (categoryId) =>
              getCategoryDepth(this.currentCategories, categoryId) -
              editingDepth +
              1,
          ),
        )
      : 1
    const nextParentDepth = parent
      ? getCategoryDepth(this.currentCategories, parent.id)
      : 0
    const invalidParent = Boolean(
      input.parentCategoryId &&
      (!parent ||
        parent.id === editingCategoryId ||
        descendantIds.has(parent.id) ||
        isSplitCategory(parent) ||
        usageTypes.some((usageType) => !parent.usageTypes.includes(usageType))),
    )
    if (
      !name ||
      name.length > 30 ||
      !/^#[0-9a-f]{6}$/i.test(input.color) ||
      !input.icon.trim() ||
      usageTypes.length === 0 ||
      nextParentDepth + subtreeHeight > MAX_CATEGORY_DEPTH ||
      invalidParent
    ) {
      this.managementErrorMessage =
        "카테고리 이름·용도·색상·상위 단계를 확인해 주세요."
      return undefined
    }
    return {
      ...input,
      name,
      icon: input.icon.trim(),
      usageTypes,
      parentCategoryId: parent?.id,
    }
  }

  private canManageCurrentLedger(): boolean {
    const ledger = this.currentLedger
    return Boolean(
      this.authUser &&
      ledger &&
      !ledger.archivedAt &&
      ledger.role !== "viewer" &&
      this.dataStatus !== "stale" &&
      this.dataStatus !== "error",
    )
  }

  private async runManagementMutation(
    mutation: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    if (
      this.managementMutationState !== "idle" ||
      !this.authUser ||
      !this.hasLoadedFinanceData ||
      this.dataStatus === "stale"
    ) {
      this.managementErrorMessage =
        "최신 관리 정보를 불러온 뒤 다시 시도해 주세요."
      return false
    }
    this.clearManagementFeedback()
    this.managementMutationState = "saving"
    try {
      await mutation()
      this.invalidateFinanceQueryCache()
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.managementMutationState = "idle"
        this.managementNoticeMessage = successMessage
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.managementMutationState = "idle"
        this.managementErrorMessage = mutationErrorMessage(
          error,
          "변경 내용을 저장하지 못했습니다.",
        )
      })
      return false
    }
  }

  async acceptLegalTerms(): Promise<void> {
    if (!this.authUser || this.consentStatus === "saving") return

    this.consentStatus = "saving"
    this.consentErrorMessage = undefined

    try {
      await this.repository.acceptLegalTerms(
        CURRENT_TERMS_VERSION,
        CURRENT_PRIVACY_VERSION,
      )
      await this.loadSelectedMonth(this.selectedMonth, true, true)
      runInAction(() => {
        this.consentStatus = "idle"
      })
    } catch (error) {
      runInAction(() => {
        this.consentStatus = "error"
        this.consentErrorMessage = errorMessage(
          error,
          "필수 동의를 기록하지 못했습니다.",
        )
      })
    }
  }

  async acceptNotificationPrivacyDisclosure(): Promise<boolean> {
    try {
      const status = await acceptNotificationDisclosure()
      runInAction(() => {
        this.notificationCaptureStatus = status
        this.notificationInboxErrorMessage = undefined
      })
      return status.hasDisclosureConsent
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 개인정보 동의를 저장하지 못했습니다.",
        )
      })
      return false
    }
  }

  async configureNotificationInbox(input: {
    allowedPackageNames: string[]
    enabled: boolean
    reviewNotificationsEnabled?: boolean
    targetLedgerId: string
  }): Promise<boolean> {
    if (
      input.enabled &&
      (!this.notificationCaptureStatus.hasDisclosureConsent ||
        !this.selectableLedgers.some(
          (ledger) => ledger.id === input.targetLedgerId,
        ))
    ) {
      this.notificationInboxErrorMessage =
        "개인정보 고지 동의와 대상 가계부 선택이 필요합니다."
      return false
    }

    try {
      const status = await configureNotificationCapture({
        allowedPackageNames: input.allowedPackageNames,
        enabled: input.enabled,
        reviewNotificationsEnabled:
          input.reviewNotificationsEnabled ??
          this.notificationCaptureStatus.reviewNotificationsEnabled,
        targetLedgerId: input.targetLedgerId,
      })
      runInAction(() => {
        this.notificationCaptureStatus = status
        this.notificationInboxErrorMessage = undefined
        if (!status.isCollectionEnabled) {
          this.notificationCandidates = []
        }
      })
      return input.enabled ? status.isCollectionEnabled : true
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 수집 설정을 저장하지 못했습니다.",
        )
      })
      return false
    }
  }

  async openNotificationPermissionSettings(): Promise<boolean> {
    if (!this.notificationCaptureStatus.hasDisclosureConsent) {
      this.notificationInboxErrorMessage =
        "개인정보 고지에 동의한 뒤 알림 접근을 설정해 주세요."
      return false
    }

    try {
      await openNotificationAccessSettings()
      return true
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "Android 알림 접근 설정을 열지 못했습니다.",
        )
      })
      return false
    }
  }

  async refreshNotificationInbox(): Promise<void> {
    const userId = this.authUser?.id
    if (!userId || this.notificationInboxStatus === "loading") return

    this.notificationInboxStatus = "loading"
    this.notificationInboxErrorMessage = undefined

    try {
      const expiredCount = await deleteExpiredNotificationRecords()
      const status = await getNotificationCaptureStatus()
      const records = status.hasDisclosureConsent
        ? await readStoredNotificationRecords()
        : []
      const targetLedgerId = this.selectableLedgers.some(
        (ledger) => ledger.id === status.targetLedgerId,
      )
        ? status.targetLedgerId
        : this.defaultLedgerId
      const deferredIds = new Set(
        this.notificationCandidates
          .filter((candidate) => candidate.status === "deferred")
          .map((candidate) => candidate.id),
      )
      const candidates = records.map((record) => {
        const candidate = createCandidateFromNotificationRecord({
          record,
          targetLedgerId,
          userId,
        })
        return deferredIds.has(candidate.id)
          ? { ...candidate, status: "deferred" as const }
          : candidate
      })

      runInAction(() => {
        this.notificationCaptureStatus = {
          ...status,
          storedRecordCount: candidates.length,
        }
        this.notificationCandidates = candidates
        this.notificationInboxStatus = "ready"
        if (expiredCount > 0) {
          this.notificationInboxNoticeMessage = `7일이 지난 알림 후보 ${expiredCount}건을 기기에서 자동 삭제했습니다.`
        }
      })
    } catch (error) {
      runInAction(() => {
        this.notificationInboxStatus = "error"
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 후보를 불러오지 못했습니다.",
        )
      })
    }
  }

  deferNotificationCandidate(candidateId: string): void {
    this.notificationCandidates = this.notificationCandidates.map(
      (candidate) =>
        candidate.id === candidateId
          ? {
              ...candidate,
              status: "deferred",
              promptCount: candidate.promptCount + 1,
              lastPromptedAt: new Date().toISOString(),
            }
          : candidate,
    )
  }

  clearNotificationRegistrationError(): void {
    this.notificationRegistrationErrorMessage = undefined
  }

  async registerNotificationCandidate(
    draft: CandidateRegistrationDraft,
  ): Promise<NotificationCandidateRegistrationResult> {
    if (this.notificationRegistrationState === "saving") {
      return { status: "error" }
    }

    const candidate = this.notificationCandidates.find(
      (item) => item.id === draft.candidateId,
    )
    const userId = this.authUser?.id
    if (!candidate || !userId) {
      this.notificationRegistrationErrorMessage =
        "등록할 알림 후보를 찾지 못했습니다. 후보함을 새로고침해 주세요."
      return { status: "error" }
    }

    const validation = validateCandidateRegistrationDraft(draft, candidate, {
      authUserId: userId,
      canWriteData: this.dataStatus !== "stale" && this.dataStatus !== "error",
      categories: this.financeData.categories,
      defaultLedgerId: this.defaultLedgerId,
      ledgers: this.selectableLedgers,
      members: this.financeData.members,
      paymentMethods: this.financeData.paymentMethods,
    })
    if (!validation.valid) {
      this.notificationRegistrationErrorMessage = validation.message
      return { status: "error" }
    }

    this.notificationRegistrationState = "saving"
    this.notificationRegistrationErrorMessage = undefined

    const { input, registrationState } = validation.value
    try {
      const persisted = await saveStoredNotificationRegistrationState(
        candidate.id,
        {
          amount: registrationState.amount,
          categoryId: registrationState.categoryId,
          merchantName: registrationState.merchantName ?? "",
          memo: registrationState.memo ?? "",
          paymentMethodId: registrationState.paymentMethodId ?? "",
          targetLedgerId: registrationState.targetLedgerId,
          tags: registrationState.tags ?? [],
          transactionAt: registrationState.transactionAt,
        },
      )
      if (!persisted) {
        runInAction(() => {
          this.notificationRegistrationState = "idle"
          this.notificationRegistrationErrorMessage =
            "기기의 암호화 저장소에 등록 대기 정보를 보관하지 못했습니다. 거래는 서버로 전송하지 않았습니다."
        })
        return { status: "error" }
      }
    } catch {
      runInAction(() => {
        this.notificationRegistrationState = "idle"
        this.notificationRegistrationErrorMessage =
          "기기의 암호화 저장소에 등록 대기 정보를 보관하지 못했습니다. 거래는 서버로 전송하지 않았습니다."
      })
      return { status: "error" }
    }

    runInAction(() => {
      this.notificationCandidates = this.notificationCandidates.map((item) =>
        item.id === candidate.id
          ? {
              ...item,
              parsed: {
                ...item.parsed,
                amount: registrationState.amount,
                merchantName: registrationState.merchantName,
                targetLedgerId: registrationState.targetLedgerId,
                transactionAt: registrationState.transactionAt,
              },
              registrationState,
              status: "registration_pending",
              targetLedgerId: registrationState.targetLedgerId,
            }
          : item,
      )
    })

    const abortController = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let serverResult: "saved" | "already_registered"
    let transactionId: string | undefined

    try {
      try {
        transactionId = await Promise.race([
          this.repository.saveTransaction(userId, input, {
            signal: abortController.signal,
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new TransactionSaveTimeoutError())
              abortController.abort()
            }, TRANSACTION_SAVE_TIMEOUT_MS)
          }),
        ])
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }
        if (!transactionId) {
          throw new Error("저장된 거래를 확인하지 못했습니다.")
        }
        serverResult = "saved"
      } catch (error) {
        if (error instanceof DuplicateTransactionSourceError) {
          serverResult = "already_registered"
        } else {
          runInAction(() => {
            this.notificationRegistrationState = "idle"
            this.notificationRegistrationErrorMessage =
              isRetryableCandidateRegistrationError(error)
                ? "네트워크 연결을 확인하지 못해 암호화된 등록 대기로 보관했습니다. 연결 후 다시 등록해 주세요."
                : "거래를 등록하지 못했습니다. 후보는 암호화된 등록 대기로 유지됩니다."
          })
          return { status: "pending" }
        }
      }

      const deleted = await deleteStoredNotificationRecord(candidate.id)
      if (!deleted) {
        runInAction(() => {
          this.notificationRegistrationState = "idle"
          this.notificationRegistrationErrorMessage =
            "거래는 확인됐지만 기기의 후보를 정리하지 못했습니다. 다시 등록하면 중복 없이 정리를 재시도합니다."
        })
        return { status: "pending" }
      }

      runInAction(() => {
        this.notificationCandidates = this.notificationCandidates.filter(
          (item) => item.id !== candidate.id,
        )
        this.notificationCaptureStatus = {
          ...this.notificationCaptureStatus,
          storedRecordCount: this.notificationCandidates.length,
        }
        this.notificationRegistrationState = "idle"
        this.notificationRegistrationErrorMessage = undefined
        if (
          transactionId &&
          toMonthKey(new Date(input.transactionAt)) === this.selectedMonth
        ) {
          this.applyOptimisticTransaction(transactionId, input, userId)
        }
      })
      void this.loadSelectedMonth(this.selectedMonth, true)

      if (serverResult === "already_registered") {
        return { status: "already_registered" }
      }
      if (!transactionId) {
        return { status: "pending" }
      }
      return { status: "saved", transactionId }
    } catch {
      runInAction(() => {
        this.notificationRegistrationState = "idle"
        this.notificationRegistrationErrorMessage =
          "거래 저장 결과를 정리하지 못했습니다. 후보는 암호화된 등록 대기로 유지됩니다."
      })
      return { status: "pending" }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  async excludeNotificationCandidate(candidateId: string): Promise<boolean> {
    try {
      const deleted = await deleteStoredNotificationRecord(candidateId)
      if (!deleted) return false
      runInAction(() => {
        this.notificationCandidates = this.notificationCandidates.filter(
          (candidate) => candidate.id !== candidateId,
        )
        this.notificationCaptureStatus = {
          ...this.notificationCaptureStatus,
          storedRecordCount: this.notificationCandidates.length,
        }
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 후보를 제외하지 못했습니다.",
        )
      })
      return false
    }
  }

  async deleteNotificationCandidates(candidateIds: string[]): Promise<number> {
    const requestedIds = new Set(candidateIds)
    const existingIds = this.notificationCandidates
      .map((candidate) => candidate.id)
      .filter((candidateId) => requestedIds.has(candidateId))
    if (existingIds.length === 0) return 0

    this.notificationInboxErrorMessage = undefined
    const results = await Promise.all(
      existingIds.map(async (candidateId) => {
        try {
          return {
            candidateId,
            deleted: await deleteStoredNotificationRecord(candidateId),
          }
        } catch {
          return { candidateId, deleted: false }
        }
      }),
    )
    const deletedIds = new Set(
      results
        .filter((result) => result.deleted)
        .map((result) => result.candidateId),
    )

    runInAction(() => {
      this.notificationCandidates = this.notificationCandidates.filter(
        (candidate) => !deletedIds.has(candidate.id),
      )
      this.notificationCaptureStatus = {
        ...this.notificationCaptureStatus,
        storedRecordCount: this.notificationCandidates.length,
      }
      if (deletedIds.size < existingIds.length) {
        this.notificationInboxErrorMessage = `선택한 후보 ${existingIds.length}건 중 ${deletedIds.size}건만 삭제했습니다. 남은 후보를 다시 시도해 주세요.`
      }
    })
    return deletedIds.size
  }

  async deleteAllNotificationCandidates(): Promise<boolean> {
    try {
      await deleteAllStoredNotificationRecords()
      runInAction(() => {
        this.notificationCandidates = []
        this.notificationCaptureStatus = {
          ...this.notificationCaptureStatus,
          storedRecordCount: 0,
        }
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 후보를 모두 삭제하지 못했습니다.",
        )
      })
      return false
    }
  }

  async revokeNotificationPrivacyDisclosure(): Promise<boolean> {
    try {
      const status = await revokeNotificationDisclosure()
      runInAction(() => {
        this.notificationCaptureStatus = status
        this.notificationCandidates = []
        this.notificationInboxStatus = "ready"
        this.notificationInboxErrorMessage = undefined
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.notificationInboxErrorMessage = errorMessage(
          error,
          "알림 개인정보 동의를 철회하지 못했습니다.",
        )
      })
      return false
    }
  }

  private handleAuthEvent(
    event: AuthSessionEvent,
    session: AuthSessionInfo | null,
  ): void {
    if (!session) {
      const wasAuthenticated = Boolean(this.authUser)
      const wasSigningOut = this.authState === "signingOut"
      void this.safelyClearNotificationCaptureSession()
      this.resetSession()
      if (wasAuthenticated && !wasSigningOut && event === "SIGNED_OUT") {
        this.authErrorMessage =
          "로그인 세션이 만료되었습니다. 다시 로그인해 주세요."
      }
      return
    }

    if (
      event === "TOKEN_REFRESHED" &&
      session.user.id === this.activeSessionUserId
    ) {
      this.authUser = session.user
      return
    }

    void Promise.resolve().then(() => this.activateSession(session))
  }

  private async activateSession(session: AuthSessionInfo): Promise<void> {
    if (
      this.activeSessionUserId === session.user.id &&
      this.activationPromise
    ) {
      return this.activationPromise
    }
    if (
      this.activeSessionUserId === session.user.id &&
      (this.dataStatus === "ready" || this.dataStatus === "error")
    ) {
      this.authUser = session.user
      this.authState = "authenticated"
      return
    }

    if (this.activeSessionUserId !== session.user.id) {
      this.clearFinanceData()
      this.sessionSequence += 1
    }

    this.activeSessionUserId = session.user.id
    this.authUser = session.user
    this.authState = "authenticated"
    this.authErrorMessage = undefined

    const activation = this.finishSessionActivation(session.user.id)
    this.activationPromise = activation
    try {
      await activation
    } finally {
      if (this.activationPromise === activation) {
        this.activationPromise = undefined
      }
    }
  }

  private async finishSessionActivation(userId: string): Promise<void> {
    try {
      await this.authGateway.ensureProfile()
    } catch (error) {
      await this.rejectSession(error)
      return
    }

    if (userId !== this.authUser?.id) return
    const sessionSequence = this.sessionSequence
    const notificationSetup = setAuthenticatedNotificationCaptureUser(userId)
      .then(() => true)
      .catch(() => false)
    await this.loadSelectedMonth()
    if (userId === this.authUser?.id) {
      void this.finishNotificationActivation(
        userId,
        sessionSequence,
        notificationSetup,
      )
    }
  }

  private async finishNotificationActivation(
    userId: string,
    sessionSequence: number,
    notificationSetup: Promise<boolean>,
  ): Promise<void> {
    const configured = await notificationSetup
    if (!configured) return
    if (
      userId !== this.authUser?.id ||
      sessionSequence !== this.sessionSequence
    ) {
      await this.safelyClearNotificationCaptureSession()
      return
    }
    await this.refreshNotificationInbox()
  }

  private async rejectSession(error: unknown): Promise<void> {
    try {
      await this.authGateway.clearLocalSession()
    } catch {
      // 원래 인증 오류를 사용자에게 유지한다.
    }

    await this.safelyClearNotificationCaptureSession()

    runInAction(() => {
      this.resetSession()
      this.authErrorMessage = errorMessage(
        error,
        "로그인 세션을 복원하지 못했습니다.",
      )
    })
  }

  private resetSession(): void {
    this.sessionSequence += 1
    this.activeSessionUserId = undefined
    this.activationPromise = undefined
    this.authUser = undefined
    this.authState = "anonymous"
    this.clearFinanceData()
  }

  private async safelyClearNotificationCaptureSession(): Promise<void> {
    try {
      await clearNotificationCaptureSession()
    } catch {
      // 인증 종료는 네이티브 저장소 정리 오류와 무관하게 계속한다.
    }
  }

  private clearFinanceData(): void {
    this.dataRequestSequence += 1
    this.financeData = createEmptyFinanceData()
    this.selectedLedgerId = ""
    this.dataStatus = "idle"
    this.dataErrorMessage = undefined
    this.consentStatus = "idle"
    this.consentErrorMessage = undefined
    this.transactionMutationState = "idle"
    this.transactionMutationErrorMessage = undefined
    this.managementMutationState = "idle"
    this.profilePreferenceMutationState = "idle"
    this.managementErrorMessage = undefined
    this.managementNoticeMessage = undefined
    this.dataToolState = "idle"
    this.dataToolErrorMessage = undefined
    this.dataToolNoticeMessage = undefined
    this.clearTransactionSearchRange()
    this.notificationCaptureStatus = createEmptyNotificationCaptureStatus()
    this.notificationCandidates = []
    this.notificationInboxStatus = "idle"
    this.notificationInboxErrorMessage = undefined
    this.notificationInboxNoticeMessage = undefined
    this.notificationRegistrationState = "idle"
    this.notificationRegistrationErrorMessage = undefined
    this.invalidateFinanceQueryCache()
  }

  private invalidateFinanceQueryCache(): void {
    this.financeCacheGeneration += 1
    this.financeQueryCache.clear()
    this.prefetchingMonths.clear()
  }

  private applyOptimisticTransaction(
    transactionId: string,
    input: RemoteTransactionInput,
    userId: string,
  ): void {
    const existing = this.financeData.transactions.find(
      (transaction) => transaction.id === transactionId,
    )
    const transactionMonth = toMonthKey(new Date(input.transactionAt))
    const monthTransactions = this.financeData.transactions.filter(
      (transaction) =>
        transaction.id !== transactionId &&
        toMonthKey(new Date(transaction.transactionAt)) === transactionMonth,
    )
    const monthTransactionIds = new Set(
      monthTransactions.map((transaction) => transaction.id),
    )
    const now = new Date().toISOString()
    const transaction: Transaction = {
      id: transactionId,
      ledgerId: input.ledgerId,
      createdBy: existing?.createdBy ?? userId,
      updatedBy: userId,
      actorUserId: input.actorUserId,
      recurringRuleId: input.recurringRuleId ?? existing?.recurringRuleId,
      recurringType: input.recurringType ?? existing?.recurringType,
      installmentNumber: existing?.installmentNumber,
      installmentTotal: input.installmentMonths ?? existing?.installmentTotal,
      type: input.type,
      incomeKind: input.incomeKind,
      status: input.status,
      amount: input.amount,
      currency: "KRW",
      transactionAt: input.transactionAt,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      merchantName: input.merchantName,
      memo: input.memo,
      sourceType: input.sourceType ?? existing?.sourceType ?? "manual",
      sourceApp: input.sourceApp,
      sourceSender: input.sourceSender,
      sourceHash: input.sourceHash,
      parseConfidence: input.parseConfidence,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      tags: input.tags ?? existing?.tags ?? [],
    }
    const existingSplits = this.financeData.transactionSplits.filter(
      (split) => split.transactionId === transactionId,
    )
    const transactionSplits =
      input.splits === undefined
        ? existingSplits
        : input.splits.map((split, index) => ({
            id: `${transactionId}:${index}`,
            transactionId,
            categoryId: split.categoryId,
            amount: split.amount,
            sortOrder: index,
          }))

    this.financeData = {
      ...this.financeData,
      transactions: [transaction, ...monthTransactions],
      transactionSplits: [
        ...transactionSplits,
        ...this.financeData.transactionSplits.filter((split) =>
          monthTransactionIds.has(split.transactionId),
        ),
      ],
    }
    this.financeQueryCache.set(
      createFinanceCacheKey(userId, transactionMonth),
      this.financeData,
    )
  }

  private applyFinanceData(financeData: FinanceData): void {
    this.financeData = financeData
    if (
      !this.selectableLedgers.some(
        (ledger) => ledger.id === this.selectedLedgerId,
      )
    ) {
      this.selectedLedgerId = this.selectableLedgers[0]?.id ?? ""
    }
  }

  private ensureSelectedDateBelongsToMonth(month: string): void {
    if (!this.selectedDate.startsWith(`${month}-`)) {
      this.selectedDate = `${month}-01`
    }
  }
}

function createEmptyNotificationCaptureStatus(): NotificationCaptureStatus {
  return {
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
}

export function createMobileAppStore(now = new Date()): MobileAppStore {
  const client = requireSupabaseMobileClient()
  return new MobileAppStore(
    new SupabaseFinanceRepository(client),
    createMobileAuthGateway(client),
    now,
    new QueryCache<FinanceData>(),
    true,
  )
}

export function createKoreaMonthTransactionRange(
  monthKey: string,
): TransactionDateRange {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  const year = Number(match?.[1])
  const month = Number(match?.[2])

  if (!match || month < 1 || month > 12) {
    throw new Error("조회 월은 YYYY-MM 형식이어야 합니다.")
  }

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`

  return {
    start: `${monthKey}-01T00:00:00+09:00`,
    endExclusive: `${nextMonthKey}-01T00:00:00+09:00`,
  }
}

export function createKoreaTransactionDateRange(
  startDate: string,
  endDate: string,
): TransactionDateRange {
  if (!isDateKey(startDate) || !isDateKey(endDate) || endDate < startDate) {
    throw new Error("조회 기간을 올바르게 입력해 주세요.")
  }
  const [year, month, day] = endDate.split("-").map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10)
  return {
    start: `${startDate}T00:00:00+09:00`,
    endExclusive: `${nextDate}T00:00:00+09:00`,
  }
}

function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function validateCardInput(
  input: MobileCardInput,
): MobileCardInput | undefined {
  const name = input.name.trim()
  const issuer = input.issuer.trim()
  const last4 = input.last4?.trim() || undefined
  if (
    !name ||
    !issuer ||
    (last4 && !/^\d{4}$/.test(last4)) ||
    !Number.isSafeInteger(input.paymentDay) ||
    input.paymentDay < 1 ||
    input.paymentDay > 31 ||
    !Number.isSafeInteger(input.billingPeriodEndDay) ||
    input.billingPeriodEndDay < 1 ||
    input.billingPeriodEndDay > 31
  ) {
    return undefined
  }
  return { ...input, issuer, last4, name }
}

function validateAccountInput(
  input: MobileAccountInput,
): MobileAccountInput | undefined {
  const name = input.name.trim()
  const bank = input.bank.trim()
  const last4 = input.last4?.trim() || undefined
  if (!name || !bank || (last4 && !/^\d{4}$/.test(last4))) return undefined
  return { bank, last4, name }
}

function normalizeImportedTransaction(
  value: unknown,
): MobileImportedTransaction | undefined {
  if (!isRecord(value)) return undefined
  if (
    (value.type !== "expense" &&
      value.type !== "income" &&
      value.type !== "saving") ||
    (value.status !== "confirmed" && value.status !== "excluded") ||
    !Number.isSafeInteger(value.amount) ||
    Number(value.amount) <= 0 ||
    typeof value.transactionAt !== "string" ||
    Number.isNaN(Date.parse(value.transactionAt))
  ) {
    return undefined
  }
  const tags = Array.isArray(value.tags)
    ? [
        ...new Set(
          value.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().slice(0, 20))
            .filter(Boolean),
        ),
      ].slice(0, 10)
    : []
  return {
    type: value.type,
    status: value.status,
    amount: Number(value.amount),
    transactionAt: value.transactionAt,
    categoryId: optionalImportedString(value.categoryId),
    paymentMethodId: optionalImportedString(value.paymentMethodId),
    merchantName: optionalImportedString(value.merchantName)?.slice(0, 100),
    memo: optionalImportedString(value.memo)?.slice(0, 500),
    actorUserId: optionalImportedString(value.actorUserId),
    tags,
  }
}

function transactionDuplicateKey(
  transaction: Pick<
    Transaction,
    "type" | "amount" | "transactionAt" | "merchantName"
  >,
): string {
  return [
    transaction.type,
    transaction.amount,
    new Date(transaction.transactionAt).toISOString(),
    transaction.merchantName?.trim().toLowerCase() ?? "",
  ].join("|")
}

function optionalImportedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function dataLoadErrorMessage(error: unknown, fallback: string): string {
  return isNetworkError(error) ? "네트워크에 연결할 수 없습니다." : fallback
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return "네트워크 연결이 원활하지 않아 저장 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요. 입력 내용은 그대로 유지됩니다."
  }

  return errorMessage(error, fallback)
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /fetch failed|failed to fetch|network(?: request)? (?:failed|unavailable)|unknownhostexception|unable to resolve host/i.test(
      error.message,
    )
  )
}

function createFinanceCacheKey(userId: string, month: string): string {
  return `${userId}:${month}`
}

function mergeFinanceTransactionData(
  financeData: FinanceData,
  transactionData: TransactionData,
): FinanceData {
  return {
    ...financeData,
    transactions: transactionData.transactions,
    transactionSplits: transactionData.transactionSplits,
  }
}
