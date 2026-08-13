import {
  createEmptyFinanceData,
  SupabaseFinanceRepository,
  type AuthSessionEvent,
  type AuthSessionInfo,
  type AuthUserInfo,
  type FinanceData,
  type FinanceLoadOptions,
  type RemoteTransactionInput,
  type TransactionDateRange,
} from "@salimon/api-client"
import {
  getDescendantCategoryIds,
  moveMonth,
  toDateKey,
  toMonthKey,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  type Category,
  type Ledger,
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
  type MonthDaySummary,
  type TransactionTotals,
} from "../features/dashboard/dashboardPresentation"
import { isGeneralMobileTransaction } from "../features/transactions/transactionDraft"
import { QueryCache } from "../infrastructure/queryCache"
import { requireSupabaseMobileClient } from "../infrastructure/supabase"
import {
  clearNotificationCaptureSession,
  setAuthenticatedNotificationCaptureUser,
} from "../native/notificationListener"

type MobileFinanceRepository = Pick<
  SupabaseFinanceRepository,
  | "acceptLegalTerms"
  | "createLedger"
  | "load"
  | "materializeMonth"
  | "saveTransaction"
  | "softDeleteTransaction"
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

export type MobileTransactionSaveResult =
  | { status: "saved"; transactionId: string }
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

export class MobileAppStore {
  selectedDate: string
  selectedLedgerId = ""
  selectedMonth: string
  authState: MobileAuthState = "checking"
  authUser?: AuthUserInfo
  financeData: FinanceData = createEmptyFinanceData()
  dataStatus: MobileDataStatus = "idle"
  consentStatus: MobileConsentStatus = "idle"
  transactionMutationState: MobileTransactionMutationState = "idle"
  authErrorMessage?: string
  dataErrorMessage?: string
  consentErrorMessage?: string
  transactionMutationErrorMessage?: string

  private activeSessionUserId?: string
  private dataRequestSequence = 0
  private readonly financeQueryCache: QueryCache<FinanceData>
  private sessionSequence = 0
  private activationPromise?: Promise<void>

  constructor(
    private readonly repository: MobileFinanceRepository,
    private readonly authGateway: MobileAuthGateway,
    now = new Date(),
    financeQueryCache = new QueryCache<FinanceData>(),
  ) {
    this.selectedMonth = toMonthKey(now)
    this.selectedDate = toDateKey(now)
    this.financeQueryCache = financeQueryCache
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

  get currentLedgerName(): string {
    return this.currentLedger?.name ?? "내 가계부"
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
  ): Promise<void> {
    const userId = this.authUser?.id
    if (!userId) return

    const sequence = this.sessionSequence
    const requestSequence = ++this.dataRequestSequence
    const cacheKey = createFinanceCacheKey(userId, month)
    const cached = this.financeQueryCache.get(cacheKey)
    const options: FinanceLoadOptions = {
      transactionDateRange: createKoreaMonthTransactionRange(month),
    }

    this.selectedMonth = month
    this.ensureSelectedDateBelongsToMonth(month)
    this.dataErrorMessage = undefined

    if (cached?.isFresh && !forceRefresh) {
      this.applyFinanceData(cached.data)
      this.dataStatus = "ready"
      return
    }

    if (cached) {
      this.applyFinanceData(cached.data)
      this.dataStatus = "refreshing"
    } else {
      this.dataStatus = "loading"
    }

    try {
      await this.repository.materializeMonth(month)
      let financeData = await this.repository.load(userId, options)

      if (financeData.ledgers.length === 0) {
        await this.repository.createLedger({
          name: "내 가계부",
          type: "personal",
          setDefault: true,
          paymentInstrumentIds: [],
          ledgerVisibleInstrumentIds: [],
        })
        await this.repository.materializeMonth(month)
        financeData = await this.repository.load(userId, options)
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
    } catch (error) {
      if (
        sequence !== this.sessionSequence ||
        requestSequence !== this.dataRequestSequence ||
        userId !== this.authUser?.id
      ) {
        return
      }

      runInAction(() => {
        const message = errorMessage(
          error,
          "가계부 데이터를 불러오지 못했습니다.",
        )
        if (cached) {
          this.applyFinanceData(cached.data)
          this.dataStatus = "stale"
          this.dataErrorMessage = `${message} 마지막 조회 내용을 읽기 전용으로 표시합니다.`
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
      input.ledgerId !== this.selectedLedgerId ||
      input.recurringType ||
      input.recurringRuleId ||
      (input.splits?.length ?? 0) > 0
    ) {
      this.transactionMutationErrorMessage =
        "현재 가계부에서 일반 거래를 저장할 권한이 없습니다."
      return { status: "error" }
    }

    this.transactionMutationState = "saving"
    this.transactionMutationErrorMessage = undefined

    const abortController = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      const transactionId = await Promise.race([
        this.repository.saveTransaction(this.authUser.id, input, {
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
      const savedTransactionId = transactionId ?? input.id
      if (!savedTransactionId) {
        throw new Error("저장된 거래를 확인하지 못했습니다.")
      }

      this.selectedDate = toDateKey(new Date(input.transactionAt))
      await this.loadSelectedMonth(
        toMonthKey(new Date(input.transactionAt)),
        true,
      )
      runInAction(() => {
        this.transactionMutationState = "idle"
      })
      return { status: "saved", transactionId: savedTransactionId }
    } catch (error) {
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.transactionMutationErrorMessage =
          error instanceof TransactionSaveTimeoutError
            ? TRANSACTION_SAVE_TIMEOUT_MESSAGE
            : errorMessage(
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

    const transaction = this.financeData.transactions.find(
      (item) => item.id === transactionId && !item.deletedAt,
    )
    const splitCount = this.financeData.transactionSplits.filter(
      (split) => split.transactionId === transactionId,
    ).length
    if (
      !this.authUser ||
      !this.canMutateCurrentLedger ||
      !transaction ||
      transaction.ledgerId !== this.selectedLedgerId ||
      !isGeneralMobileTransaction(transaction, splitCount)
    ) {
      this.transactionMutationErrorMessage =
        "일반 거래만 모바일에서 삭제할 수 있습니다."
      return false
    }

    this.transactionMutationState = "deleting"
    this.transactionMutationErrorMessage = undefined

    try {
      await this.repository.softDeleteTransaction(
        transactionId,
        this.authUser.id,
      )
      await this.loadSelectedMonth(this.selectedMonth, true)
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

  async moveSelectedMonth(amount: number): Promise<void> {
    const month = moveMonth(this.selectedMonth, amount)
    this.selectedDate = `${month}-01`
    await this.loadSelectedMonth(month)
  }

  selectLedger(ledgerId: string): void {
    if (!this.selectableLedgers.some((ledger) => ledger.id === ledgerId)) {
      return
    }
    this.selectedLedgerId = ledgerId
  }

  selectDate(date: string): void {
    if (this.monthDaySummaries.some((summary) => summary.date === date)) {
      this.selectedDate = date
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
      await this.loadSelectedMonth(this.selectedMonth, true)
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
      await setAuthenticatedNotificationCaptureUser(userId)
    } catch {
      // 알림 자동 수집 오류가 수동 가계부 로그인을 막지 않게 한다.
    }

    try {
      await this.authGateway.ensureProfile()
    } catch (error) {
      await this.rejectSession(error)
      return
    }

    if (userId !== this.authUser?.id) return
    await this.loadSelectedMonth()
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
    this.financeQueryCache.clear()
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

export function createMobileAppStore(now = new Date()): MobileAppStore {
  const client = requireSupabaseMobileClient()
  return new MobileAppStore(
    new SupabaseFinanceRepository(client),
    createMobileAuthGateway(client),
    now,
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function createFinanceCacheKey(userId: string, month: string): string {
  return `${userId}:${month}`
}
