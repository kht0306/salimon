import {
  checkSupabaseConnection,
  clearLocalAuthSession,
  createTransactionRequestId,
  createEmptyFinanceData,
  ensureAuthenticatedProfile,
  getCurrentAuthSession,
  observeAuthSession,
  signInWithKakao,
  signOutFromSupabase,
  SupabaseFinanceRepository,
  type AuthSessionInfo,
  type AuthUserInfo,
  type AcceptLedgerInviteResult,
  type CreatedLedgerInvitation,
  type FinanceData,
  type RemoteTransactionInput,
  type SupabaseConnectionCheck,
  type TransactionData,
  type TransactionDateRange,
} from "@salimon/api-client"
import {
  buildCategoryTree,
  findOtherCategory,
  fromDateTimeLocalValue,
  getCategoryDepth,
  getDescendantCategoryIds,
  isSplitCategory,
  maskSensitiveText,
  MAX_CATEGORY_DEPTH,
  moveMonth,
  parseCardSmsText,
  toDateKey,
  toMonthKey,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import { makeAutoObservable, runInAction } from "mobx"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@salimon/types"
import type {
  Category,
  CategoryUsageType,
  IncomeKind,
  InstallmentDeleteScope,
  Ledger,
  LedgerRole,
  LedgerType,
  LocalSmsCandidate,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"

export interface TransactionDraft {
  id?: string
  requestId?: string
  ledgerId: string
  type: TransactionType
  incomeKind?: IncomeKind
  status: TransactionStatus
  amount: number
  transactionAt: string
  categoryId?: string
  merchantName?: string
  memo?: string
  actorUserId?: string
  sourceType?: Transaction["sourceType"]
  sourceHash?: string
  parseConfidence?: number
  recurringType?: "fixed" | "installment"
  recurringRuleId?: string
  installmentMonths?: number
  installmentAmountType?: "monthly" | "principal"
  paymentMethodId?: string
  applyChangesToFuture?: boolean
  tags?: string[]
  splits?: Array<{ categoryId: string; amount: number }>
}

export interface LedgerCreationInput {
  name: string
  type: LedgerType
  setDefault: boolean
  paymentInstrumentIds: string[]
  ledgerVisibleInstrumentIds: string[]
}

export type TransactionGrouping = "actor" | "registrant" | "none"

interface MonthCacheEntry {
  data: TransactionData
  storedAt: number
}

const MONTH_CACHE_STALE_TIME_MS = 5 * 60 * 1_000
const MONTH_CACHE_MAX_ENTRIES = 6
const TRANSACTION_SAVE_TIMEOUT_MS = 15_000
const TRANSACTION_SAVE_TIMEOUT_MESSAGE =
  "네트워크 응답이 지연되어 저장 결과를 확인하지 못했습니다. 거래 목록을 확인한 뒤 다시 시도해 주세요."

class TransactionSaveTimeoutError extends Error {
  constructor() {
    super(TRANSACTION_SAVE_TIMEOUT_MESSAGE)
    this.name = "TransactionSaveTimeoutError"
  }
}

export class AppStore {
  private repository: SupabaseFinanceRepository
  private toastTimer?: ReturnType<typeof setTimeout>
  toast: {
    id: number
    tone: "success" | "error" | "info"
    message: string
  } | null = null
  data: FinanceData
  selectedLedgerId: string
  selectedMonth: string
  selectedDate: string
  calendarRegistrantId = ""
  transactionGrouping: TransactionGrouping = "actor"
  collapsedTransactionGroupKeys = new Set<string>()
  transactionEditorOpen = false
  transactionEditorDirty = false
  authState: "loading" | "authenticated" | "anonymous" | "error" = "loading"
  authUser: AuthUserInfo | null = null
  authError: string | null = null
  dataState: "idle" | "loading" | "refreshing" | "ready" | "error" = "idle"
  dataError: string | null = null
  transactionMutationState: "idle" | "saving" = "idle"
  ledgerMutationState:
    | "idle"
    | "creating"
    | "renaming"
    | "setting-default"
    | "archiving"
    | "restoring"
    | "syncing-payment-methods" = "idle"
  private initializedProfileUserId: string | null = null
  private profileInitialization: Promise<void> | null = null
  private monthRequestSequence = 0
  private readonly monthCache = new Map<string, MonthCacheEntry>()
  private readonly prefetchingMonths = new Set<string>()
  private monthCacheGeneration = 0
  supabaseConnection: SupabaseConnectionCheck = {
    state: "idle",
    hasUrl: false,
    hasAnonKey: false,
    canReachAuth: false,
    canReachSchema: false,
    isAuthenticated: false,
    message: "아직 연결 확인을 실행하지 않았습니다.",
  }

  constructor(repository = new SupabaseFinanceRepository()) {
    this.repository = repository
    this.data = createEmptyFinanceData()
    this.selectedLedgerId = ""
    this.selectedMonth = toMonthKey(new Date())
    this.selectedDate = toDateKey(new Date())
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get profile() {
    return this.data.profile
  }

  get currentLedger(): Ledger | undefined {
    return this.data.ledgers.find(
      (ledger) => ledger.id === this.selectedLedgerId,
    )
  }

  get currentMembership() {
    return this.data.members.find(
      (member) =>
        member.ledgerId === this.selectedLedgerId &&
        member.userId === this.authUser?.id,
    )
  }

  get activeLedgers() {
    return this.data.ledgers.filter((ledger) => !ledger.archivedAt)
  }

  get selectableLedgers() {
    const defaultLedgerId = this.data.members.find(
      (member) => member.userId === this.authUser?.id && member.isDefault,
    )?.ledgerId
    const defaultLedger = this.data.ledgers.find(
      (ledger) => ledger.id === defaultLedgerId && !ledger.archivedAt,
    )

    return [
      ...(defaultLedger ? [defaultLedger] : []),
      ...this.data.ledgers.filter(
        (ledger) => !ledger.archivedAt && ledger.id !== defaultLedgerId,
      ),
      ...this.data.ledgers.filter((ledger) => Boolean(ledger.archivedAt)),
    ]
  }

  get archivedOwnedLedgers() {
    return this.data.ledgers.filter(
      (ledger) =>
        Boolean(ledger.archivedAt) && ledger.ownerId === this.authUser?.id,
    )
  }

  get currentMembers() {
    return this.data.members.filter(
      (member) =>
        member.ledgerId === this.selectedLedgerId && member.status === "active",
    )
  }

  get currentCategories(): Category[] {
    const categories = this.data.categories.filter(
      (category) =>
        category.ledgerId === this.selectedLedgerId && !category.isArchived,
    )
    return buildCategoryTree(categories).map(({ category }) => category)
  }

  get expenseCategories(): Category[] {
    return this.currentCategories.filter((category) =>
      category.usageTypes.includes("expense"),
    )
  }

  get currentCards() {
    return this.currentLedgerCards.filter((method) => method.isActive)
  }

  get currentAccounts() {
    return this.currentLedgerAccounts.filter((method) => method.isActive)
  }

  get currentLedgerAccounts() {
    return this.data.paymentMethods.filter(
      (method) =>
        method.ledgerId === this.selectedLedgerId &&
        method.type === "bank" &&
        !method.isDeleted,
    )
  }

  get myPaymentInstruments() {
    return this.data.paymentInstruments
      .filter((method) => !method.isDeleted)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
  }

  get currentPaymentMethods() {
    return [...this.currentCards, ...this.currentAccounts]
  }

  get currentLedgerCards() {
    return this.data.paymentMethods.filter(
      (method) =>
        method.ledgerId === this.selectedLedgerId &&
        method.type === "card" &&
        !method.isDeleted,
    )
  }

  get currentUserPrimaryCard() {
    return this.currentCards.find(
      (card) =>
        card.ownerUserId === this.authUser?.id && Boolean(card.isPrimary),
    )
  }

  get selectedMonthBudgets() {
    return this.expenseCategories.flatMap((category) => {
      const categoryIds = getDescendantCategoryIds(
        this.data.categories.filter(
          (item) => item.ledgerId === this.selectedLedgerId,
        ),
        category.id,
      )
      const budget = this.data.categoryBudgets
        .filter(
          (item) =>
            item.categoryId === category.id &&
            item.effectiveMonth <= this.selectedMonth,
        )
        .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
      if (!budget || budget.amount <= 0) return []
      const spent = this.monthTransactions
        .filter(
          (item) => item.type === "expense" && item.status === "confirmed",
        )
        .reduce((sum, item) => {
          return (
            sum +
            transactionAmountForCategoryIds(
              item,
              this.data.transactionSplits,
              categoryIds,
            )
          )
        }, 0)
      return [{ category, amount: budget.amount, spent }]
    })
  }

  get selectedMonthNote() {
    return this.data.monthNotes.find(
      (item) =>
        item.ledgerId === this.selectedLedgerId &&
        item.month === this.selectedMonth,
    )
  }

  get monthTransactions(): Transaction[] {
    return this.data.transactions
      .filter((transaction) => {
        const date = new Date(transaction.transactionAt)
        return (
          transaction.ledgerId === this.selectedLedgerId &&
          !transaction.deletedAt &&
          toMonthKey(date) === this.selectedMonth
        )
      })
      .sort(
        (a, b) =>
          new Date(b.transactionAt).getTime() -
          new Date(a.transactionAt).getTime(),
      )
  }

  get selectedDateTransactions(): Transaction[] {
    return this.monthTransactions.filter(
      (transaction) =>
        toDateKey(new Date(transaction.transactionAt)) === this.selectedDate,
    )
  }

  get calendarMonthTransactions(): Transaction[] {
    if (!this.calendarRegistrantId) return this.monthTransactions
    return this.monthTransactions.filter(
      (transaction) => transaction.createdBy === this.calendarRegistrantId,
    )
  }

  get calendarSelectedDateTransactions(): Transaction[] {
    return this.calendarMonthTransactions.filter(
      (transaction) =>
        toDateKey(new Date(transaction.transactionAt)) === this.selectedDate,
    )
  }

  get monthExpenseTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.status === "confirmed",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  get monthIncomeTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" && transaction.status === "confirmed",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  get monthSavingTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "saving" && transaction.status === "confirmed",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  get deferredSmsCandidates(): LocalSmsCandidate[] {
    return this.data.smsCandidates.filter(
      (candidate) =>
        candidate.userId === this.profile.id &&
        candidate.status !== "registered" &&
        candidate.status !== "ignored" &&
        candidate.status !== "auto_registered_other",
    )
  }

  hydrate(data: FinanceData): void {
    this.data = data
    if (
      !this.selectableLedgers.some(
        (ledger) => ledger.id === this.selectedLedgerId,
      )
    ) {
      const defaultLedgerId = this.data.members.find(
        (member) => member.userId === this.authUser?.id && member.isDefault,
      )?.ledgerId
      this.selectedLedgerId = defaultLedgerId ?? this.activeLedgers[0]?.id ?? ""
    }
  }

  async refreshFinanceData(): Promise<void> {
    if (!this.authUser) {
      this.hydrate(createEmptyFinanceData())
      this.invalidateMonthCache()
      this.dataState = "idle"
      return
    }

    const hadData = this.data.profile.id === this.authUser.id
    this.dataState = hadData ? "refreshing" : "loading"
    this.dataError = null
    try {
      await this.repository.materializeMonth(this.selectedMonth)
      const data = await this.repository.load(this.authUser.id)
      runInAction(() => {
        this.hydrate(data)
        this.invalidateMonthCache()
        for (const offset of [-1, 0, 1] as const) {
          const month = moveMonth(this.selectedMonth, offset)
          this.setMonthCache(month, selectMonthData(data, month))
        }
        this.dataState = "ready"
      })
      this.scheduleAdjacentMonthPrefetch(this.selectedMonth)
    } catch (error) {
      runInAction(() => {
        this.dataState = hadData ? "ready" : "error"
        this.dataError =
          error instanceof Error
            ? error.message
            : "가계부 데이터를 불러오지 못했습니다."
      })
    }
  }

  async loadSelectedMonth(
    month = this.selectedMonth,
    forceRefresh = false,
  ): Promise<void> {
    if (!this.authUser) return

    const requestSequence = ++this.monthRequestSequence
    const userId = this.authUser.id
    const cached = this.getMonthCache(month)
    this.selectedMonth = month
    if (!this.selectedDate.startsWith(`${month}-`)) {
      this.selectedDate = `${month}-01`
    }
    this.dataError = null

    if (cached?.isFresh && !forceRefresh) {
      this.hydrate(mergeFinanceTransactionMonth(this.data, cached.data, month))
      this.dataState = "ready"
      this.scheduleAdjacentMonthPrefetch(month)
      return
    }

    if (cached) {
      this.hydrate(mergeFinanceTransactionMonth(this.data, cached.data, month))
    }
    this.dataState = this.data.profile.id ? "refreshing" : "loading"

    try {
      await this.repository.materializeMonth(month)
      const transactionData = await this.repository.loadTransactions(
        createKoreaMonthTransactionRange(month),
      )
      if (
        requestSequence !== this.monthRequestSequence ||
        userId !== this.authUser?.id ||
        month !== this.selectedMonth
      ) {
        return
      }
      runInAction(() => {
        this.hydrate(
          mergeFinanceTransactionMonth(this.data, transactionData, month),
        )
        this.setMonthCache(month, transactionData)
        this.dataState = "ready"
      })
      this.scheduleAdjacentMonthPrefetch(month)
    } catch (error) {
      if (
        requestSequence !== this.monthRequestSequence ||
        userId !== this.authUser?.id ||
        month !== this.selectedMonth
      ) {
        return
      }
      runInAction(() => {
        this.dataState = this.data.profile.id ? "ready" : "error"
        this.dataError =
          error instanceof Error
            ? error.message
            : "선택한 월의 거래를 불러오지 못했습니다."
      })
    }
  }

  private scheduleAdjacentMonthPrefetch(month: string): void {
    if (!this.authUser || !this.data.profile.id) return
    const userId = this.authUser.id

    for (const offset of [-1, 1] as const) {
      const adjacentMonth = moveMonth(month, offset)
      if (
        this.getMonthCache(adjacentMonth)?.isFresh ||
        this.prefetchingMonths.has(adjacentMonth)
      ) {
        continue
      }
      this.prefetchingMonths.add(adjacentMonth)
      void this.prefetchMonth(adjacentMonth, userId, this.monthCacheGeneration)
    }
  }

  private async prefetchMonth(
    month: string,
    userId: string,
    cacheGeneration: number,
  ): Promise<void> {
    try {
      await this.repository.materializeMonth(month)
      const transactionData = await this.repository.loadTransactions(
        createKoreaMonthTransactionRange(month),
      )
      if (
        userId !== this.authUser?.id ||
        cacheGeneration !== this.monthCacheGeneration
      ) {
        return
      }
      this.setMonthCache(month, transactionData)
    } catch {
      // 인접 월 사전 로딩 실패는 현재 화면을 방해하지 않는다.
    } finally {
      this.prefetchingMonths.delete(month)
    }
  }

  private getMonthCache(
    month: string,
  ): { data: TransactionData; isFresh: boolean } | undefined {
    const entry = this.monthCache.get(month)
    if (!entry) return undefined
    this.monthCache.delete(month)
    this.monthCache.set(month, entry)
    return {
      data: entry.data,
      isFresh: Date.now() - entry.storedAt <= MONTH_CACHE_STALE_TIME_MS,
    }
  }

  private setMonthCache(month: string, data: TransactionData): void {
    this.monthCache.delete(month)
    this.monthCache.set(month, { data, storedAt: Date.now() })
    while (this.monthCache.size > MONTH_CACHE_MAX_ENTRIES) {
      const oldestMonth = this.monthCache.keys().next().value
      if (oldestMonth === undefined) return
      this.monthCache.delete(oldestMonth)
    }
  }

  private invalidateMonthCache(): void {
    this.monthCacheGeneration += 1
    this.monthCache.clear()
    this.prefetchingMonths.clear()
  }

  setCalendarRegistrant(registrantId: string): void {
    this.calendarRegistrantId = registrantId
  }

  setTransactionGrouping(grouping: TransactionGrouping): void {
    this.transactionGrouping = grouping
  }

  toggleTransactionGroup(groupKey: string): void {
    if (this.collapsedTransactionGroupKeys.has(groupKey)) {
      this.collapsedTransactionGroupKeys.delete(groupKey)
      return
    }

    this.collapsedTransactionGroupKeys.add(groupKey)
  }

  notify(
    message: string,
    tone: "success" | "error" | "info" = "success",
  ): void {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toast = { id: Date.now(), tone, message }
    this.toastTimer = setTimeout(
      () =>
        runInAction(() => {
          this.toast = null
        }),
      2800,
    )
  }

  dismissToast(): void {
    this.toast = null
  }

  async checkSupabase(showToast = false): Promise<void> {
    this.supabaseConnection = {
      ...this.supabaseConnection,
      state: "checking",
      message: "Supabase 연결을 확인하는 중입니다.",
    }
    const connection = await checkSupabaseConnection()
    runInAction(() => {
      this.supabaseConnection = connection
    })
    if (showToast)
      this.notify(
        connection.state === "configured"
          ? "Supabase 연결을 확인했습니다."
          : connection.message,
        connection.state === "configured" ? "success" : "error",
      )
  }

  async initializeAuth(): Promise<void> {
    this.authState = "loading"
    this.authError = null

    try {
      await this.applyAuthSession(await getCurrentAuthSession())
    } catch (error) {
      const failedUserId = this.authUser?.id
      if (failedUserId) {
        await this.rejectAuthSession(failedUserId, error)
      } else {
        this.setAuthError(error)
      }
    }
  }

  observeAuth(): () => void {
    return observeAuthSession((_event, session) => {
      void this.applyAuthSession(session)
    })
  }

  async loginWithKakao(): Promise<void> {
    this.authState = "loading"
    this.authError = null

    try {
      await signInWithKakao()
    } catch (error) {
      this.setAuthError(error)
    }
  }

  async logout(): Promise<void> {
    this.authError = null

    try {
      await signOutFromSupabase()
      runInAction(() => {
        this.authUser = null
        this.authState = "anonymous"
        this.initializedProfileUserId = null
        this.profileInitialization = null
        this.hydrate(createEmptyFinanceData())
        this.invalidateMonthCache()
        this.transactionMutationState = "idle"
        this.dataState = "idle"
      })
      await this.checkSupabase()
    } catch (error) {
      this.setAuthError(error)
    }
  }

  switchLedger(ledgerId: string): void {
    this.selectedLedgerId = ledgerId
    this.calendarRegistrantId = ""
  }

  async setDefaultLedger(ledgerId: string): Promise<boolean> {
    if (!this.authUser || !ledgerId) return false
    if (
      this.data.ledgers.find((ledger) => ledger.id === ledgerId)?.archivedAt
    ) {
      this.notify(
        "보관중인 가계부는 기본 가계부로 설정할 수 없습니다.",
        "error",
      )
      return false
    }
    if (
      this.data.members.some(
        (member) =>
          member.ledgerId === ledgerId &&
          member.userId === this.authUser?.id &&
          member.isDefault,
      )
    ) {
      return true
    }
    if (this.ledgerMutationState !== "idle") return false

    this.ledgerMutationState = "setting-default"

    try {
      await this.repository.setDefaultLedger(ledgerId)
      await this.refreshFinanceData()
      this.notify("기본 가계부를 변경했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  selectDate(date: string): void {
    if (this.transactionMutationState !== "idle") return
    const month = date.slice(0, 7)
    const monthChanged = month !== this.selectedMonth

    this.selectedDate = date
    if (monthChanged) {
      void this.loadSelectedMonth(month)
    }
  }

  setTransactionEditorOpen(open: boolean): void {
    this.transactionEditorOpen = open
    if (!open) {
      this.transactionEditorDirty = false
    }
  }

  setTransactionEditorDirty(dirty: boolean): void {
    this.transactionEditorDirty = dirty
  }

  moveSelectedMonth(amount: number): void {
    if (this.transactionMutationState !== "idle") return
    const month = moveMonth(this.selectedMonth, amount)
    this.selectedDate = `${month}-01`
    void this.loadSelectedMonth(month)
  }

  async saveTransaction(draft: TransactionDraft): Promise<boolean> {
    if (this.transactionMutationState !== "idle") {
      this.notify("거래 저장이 끝날 때까지 기다려 주세요.", "info")
      return false
    }
    if (
      !this.authUser ||
      !draft.ledgerId ||
      !Number.isSafeInteger(draft.amount) ||
      draft.amount <= 0
    ) {
      this.notify("금액과 필수 항목을 확인해 주세요.", "error")
      return false
    }
    if (
      draft.recurringType === "installment" &&
      (!Number.isSafeInteger(draft.installmentMonths) ||
        (draft.installmentMonths ?? 0) < 2 ||
        (draft.installmentMonths ?? 0) > 120)
    ) {
      this.notify(
        "할부 개월은 2개월에서 120개월 사이로 입력해 주세요.",
        "error",
      )
      return false
    }
    if (
      draft.recurringType === "installment" &&
      !draft.id &&
      draft.installmentAmountType === "principal" &&
      draft.amount < (draft.installmentMonths ?? 0)
    ) {
      this.notify("할부 원금은 할부 개월 수 이상이어야 합니다.", "error")
      return false
    }
    if (draft.recurringType === "installment" && !draft.paymentMethodId) {
      this.notify("할부 거래에 사용할 카드를 선택해 주세요.", "error")
      return false
    }
    if (
      (draft.type === "income" && !draft.incomeKind) ||
      (draft.type !== "income" && draft.incomeKind) ||
      (draft.incomeKind === "salary" && draft.recurringType !== "fixed")
    ) {
      this.notify("수입 유형과 반복 설정을 확인해 주세요.", "error")
      return false
    }
    const tags = [
      ...new Set((draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ]
    if (tags.length > 10 || tags.some((tag) => tag.length > 20)) {
      this.notify("태그는 20자 이내로 최대 10개까지 입력해 주세요.", "error")
      return false
    }
    if (
      (draft.splits?.length ?? 0) > 0 &&
      (draft.recurringType ||
        draft.splits!.length > 10 ||
        new Set(draft.splits!.map((split) => split.categoryId)).size !==
          draft.splits!.length ||
        draft.splits!.some(
          (split) =>
            !split.categoryId ||
            !Number.isSafeInteger(split.amount) ||
            split.amount <= 0,
        ) ||
        draft.splits!.reduce((sum, split) => sum + split.amount, 0) !==
          draft.amount)
    ) {
      this.notify(
        "일반 거래의 분할 카테고리 금액 합계가 전체 금액과 같아야 합니다.",
        "error",
      )
      return false
    }

    const categoryId =
      draft.categoryId ||
      (draft.type === "expense"
        ? findOtherCategory(this.data.categories, draft.ledgerId)?.id
        : this.data.categories.find(
            (category) =>
              category.ledgerId === draft.ledgerId &&
              category.usageTypes.includes(draft.type as CategoryUsageType) &&
              !category.isArchived,
          )?.id)

    const userId = this.authUser.id
    const input: RemoteTransactionInput = {
      ...draft,
      requestId:
        draft.id || draft.requestId
          ? draft.requestId
          : createTransactionRequestId(),
      categoryId,
      tags,
      transactionAt: fromDateTimeLocalValue(draft.transactionAt),
    }
    this.transactionMutationState = "saving"
    this.dataError = null
    const abortController = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      let resultId: string | undefined
      try {
        resultId = await Promise.race([
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
      } catch (error) {
        if (
          !(error instanceof TransactionSaveTimeoutError) ||
          !input.requestId
        ) {
          throw error
        }
        const recovered = await this.repository.findTransactionRequest(
          input.requestId,
        )
        if (!recovered.transactionId && !recovered.recurringRuleId) {
          throw error
        }
        resultId = recovered.transactionId ?? recovered.recurringRuleId
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      const transactionId = input.recurringType
        ? input.id
        : (resultId ?? input.id ?? input.requestId)
      const transactionMonth = toMonthKey(new Date(input.transactionAt))
      runInAction(() => {
        this.selectedMonth = transactionMonth
        this.selectedDate = toDateKey(new Date(input.transactionAt))
        this.invalidateMonthCache()
        if (transactionId) {
          this.applyOptimisticTransaction(transactionId, input, userId)
        }
        this.transactionMutationState = "idle"
      })
      this.notify(draft.id ? "거래를 수정했습니다." : "거래를 저장했습니다.")
      void this.loadSelectedMonth(transactionMonth, true)
      return true
    } catch (error) {
      const message =
        error instanceof TransactionSaveTimeoutError
          ? TRANSACTION_SAVE_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "가계부 데이터를 저장하지 못했습니다."
      runInAction(() => {
        this.transactionMutationState = "idle"
        this.dataState = this.data.profile.id ? "ready" : "error"
        this.dataError = message
      })
      this.notify(message, "error")
      return false
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  async softDeleteTransaction(transactionId: string): Promise<void> {
    if (!this.authUser) return

    try {
      await this.repository.softDeleteTransaction(
        transactionId,
        this.authUser.id,
      )
      await this.refreshFinanceData()
      this.notify("거래를 삭제했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async createCategory(
    name: string,
    icon: string,
    color: string,
    usageTypes: CategoryUsageType[],
    budget = 0,
    parentCategoryId?: string,
  ): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed || !this.selectedLedgerId || !this.authUser) {
      this.notify("카테고리 이름을 입력해 주세요.", "error")
      return false
    }
    if (!isHexColor(color)) {
      this.notify("색상은 # 뒤에 6자리 HEX 코드로 입력해 주세요.", "error")
      return false
    }
    if (usageTypes.length === 0) {
      this.notify("카테고리 용도를 하나 이상 선택해 주세요.", "error")
      return false
    }
    if (!Number.isSafeInteger(budget) || budget < 0) {
      this.notify("올바른 예산 금액을 입력해 주세요.", "error")
      return false
    }

    const parent = parentCategoryId
      ? this.currentCategories.find(
          (category) => category.id === parentCategoryId,
        )
      : undefined
    if (
      parentCategoryId &&
      (!parent ||
        isSplitCategory(parent) ||
        getCategoryDepth(this.currentCategories, parent.id) >=
          MAX_CATEGORY_DEPTH ||
        usageTypes.some((usageType) => !parent.usageTypes.includes(usageType)))
    ) {
      this.notify("상위 카테고리와 적용 용도를 확인해 주세요.", "error")
      return false
    }

    const duplicate = this.currentCategories.some(
      (category) =>
        category.parentCategoryId === parentCategoryId &&
        category.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      this.notify("이미 같은 이름의 카테고리가 있습니다.", "error")
      return false
    }

    try {
      const categoryId = await this.repository.createCategory({
        ledgerId: this.selectedLedgerId,
        name: trimmed,
        icon,
        color,
        usageTypes,
        parentCategoryId,
      })
      if (budget > 0 && usageTypes.includes("expense")) {
        await this.repository.setCategoryBudget({
          ledgerId: this.selectedLedgerId,
          categoryId,
          month: this.selectedMonth,
          amount: budget,
          userId: this.authUser.id,
        })
      }
      await this.refreshFinanceData()
      this.notify("카테고리를 추가했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async updateCategory(
    categoryId: string,
    patch: Partial<
      Pick<
        Category,
        "name" | "icon" | "color" | "usageTypes" | "parentCategoryId"
      >
    >,
  ): Promise<boolean> {
    const category = this.data.categories.find((item) => item.id === categoryId)
    const name = patch.name?.trim()
    if (!category || (patch.name !== undefined && !name)) {
      this.notify("카테고리 이름을 입력해 주세요.", "error")
      return false
    }
    if (
      isSplitCategory(category) &&
      ((name !== undefined && name !== category.name) ||
        (patch.usageTypes !== undefined &&
          (patch.usageTypes.length !== 3 ||
            !(["expense", "income", "saving"] as const).every((usageType) =>
              patch.usageTypes?.includes(usageType),
            ))) ||
        (patch.parentCategoryId !== undefined && patch.parentCategoryId !== ""))
    ) {
      this.notify("분할 카테고리의 기본 설정은 변경할 수 없습니다.", "error")
      return false
    }
    if (patch.color !== undefined && !isHexColor(patch.color)) {
      this.notify("색상은 # 뒤에 6자리 HEX 코드로 입력해 주세요.", "error")
      return false
    }
    if (patch.usageTypes !== undefined && patch.usageTypes.length === 0) {
      this.notify("카테고리 용도를 하나 이상 선택해 주세요.", "error")
      return false
    }

    const nextName = name ?? category.name
    const nextUsageTypes = patch.usageTypes ?? category.usageTypes
    const nextParentCategoryId =
      patch.parentCategoryId !== undefined
        ? patch.parentCategoryId || undefined
        : category.parentCategoryId
    const descendants = getDescendantCategoryIds(
      this.currentCategories,
      category.id,
    )
    const parent = nextParentCategoryId
      ? this.currentCategories.find((item) => item.id === nextParentCategoryId)
      : undefined
    const currentDepth = getCategoryDepth(this.currentCategories, category.id)
    const subtreeHeight = Math.max(
      1,
      ...[...descendants].map(
        (descendantId) =>
          getCategoryDepth(this.currentCategories, descendantId) -
          currentDepth +
          1,
      ),
    )
    const nextDepth = parent
      ? getCategoryDepth(this.currentCategories, parent.id) + 1
      : 1

    if (
      nextParentCategoryId &&
      (!parent ||
        isSplitCategory(parent) ||
        descendants.has(nextParentCategoryId) ||
        nextDepth + subtreeHeight - 1 > MAX_CATEGORY_DEPTH ||
        nextUsageTypes.some(
          (usageType) => !parent.usageTypes.includes(usageType),
        ))
    ) {
      this.notify("상위 카테고리 또는 카테고리 단계를 확인해 주세요.", "error")
      return false
    }
    if (
      this.currentCategories.some(
        (child) =>
          child.parentCategoryId === category.id &&
          child.usageTypes.some(
            (usageType) => !nextUsageTypes.includes(usageType),
          ),
      )
    ) {
      this.notify(
        "하위 카테고리에서 사용하는 용도는 제거할 수 없습니다.",
        "error",
      )
      return false
    }

    if (
      this.data.categories.some(
        (item) =>
          item.id !== categoryId &&
          item.ledgerId === category.ledgerId &&
          !item.isArchived &&
          item.parentCategoryId === nextParentCategoryId &&
          item.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      this.notify("이미 같은 이름의 카테고리가 있습니다.", "error")
      return false
    }

    try {
      await this.repository.updateCategory(categoryId, {
        name: nextName,
        icon: patch.icon ?? category.icon,
        color: patch.color ?? category.color,
        usageTypes: nextUsageTypes,
        parentCategoryId: nextParentCategoryId,
      })
      await this.refreshFinanceData()
      this.notify("카테고리를 수정했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async archiveCategory(categoryId: string): Promise<void> {
    const category = this.data.categories.find((item) => item.id === categoryId)
    if (!category) return
    if (category.name === "기타" || isSplitCategory(category)) {
      this.notify("기본 카테고리는 제거할 수 없습니다.", "error")
      return
    }
    if (
      this.currentCategories.some(
        (item) => item.parentCategoryId === categoryId,
      )
    ) {
      this.notify("하위 카테고리를 먼저 이동하거나 제거해 주세요.", "error")
      return
    }

    try {
      await this.repository.archiveCategory(categoryId)
      await this.refreshFinanceData()
      this.notify("카테고리를 제거했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async reorderCategories(
    sourceCategoryId: string,
    targetCategoryId: string,
  ): Promise<boolean> {
    if (sourceCategoryId === targetCategoryId) return true

    const sourceCategory = this.currentCategories.find(
      (category) => category.id === sourceCategoryId,
    )
    const targetCategory = this.currentCategories.find(
      (category) => category.id === targetCategoryId,
    )
    if (
      !sourceCategory ||
      !targetCategory ||
      sourceCategory.parentCategoryId !== targetCategory.parentCategoryId
    ) {
      this.notify(
        "같은 단계의 카테고리끼리만 순서를 변경할 수 있습니다.",
        "error",
      )
      return false
    }

    const siblingCategories = this.currentCategories.filter(
      (category) =>
        category.parentCategoryId === sourceCategory.parentCategoryId,
    )
    const sourceIndex = siblingCategories.findIndex(
      (category) => category.id === sourceCategoryId,
    )
    const targetIndex = siblingCategories.findIndex(
      (category) => category.id === targetCategoryId,
    )
    if (sourceIndex < 0 || targetIndex < 0) return false

    const reorderedSiblings = [...siblingCategories]
    const [movedCategory] = reorderedSiblings.splice(sourceIndex, 1)
    if (!movedCategory) return false
    reorderedSiblings.splice(targetIndex, 0, movedCategory)

    const previousOrders = new Map(
      siblingCategories.map((category) => [category.id, category.sortOrder]),
    )
    const updates = reorderedSiblings.map((category, index) => ({
      categoryId: category.id,
      sortOrder: index,
    }))

    try {
      runInAction(() => {
        updates.forEach((update) => {
          const category = this.data.categories.find(
            (item) => item.id === update.categoryId,
          )
          if (category) category.sortOrder = update.sortOrder
        })
      })
      await this.repository.updateCategoryOrder(
        sourceCategory.parentCategoryId,
        updates.map((update) => update.categoryId),
      )
      await this.refreshFinanceData()
      this.notify("카테고리 순서를 변경했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      runInAction(() => {
        previousOrders.forEach((sortOrder, categoryId) => {
          const category = this.data.categories.find(
            (item) => item.id === categoryId,
          )
          if (category) category.sortOrder = sortOrder
        })
      })
      this.setDataError(error)
      return false
    }
  }

  async setCategoryBudget(
    categoryId: string,
    amount: number,
  ): Promise<boolean> {
    if (!this.authUser || !Number.isSafeInteger(amount) || amount < 0) {
      this.notify("올바른 예산 금액을 입력해 주세요.", "error")
      return false
    }
    try {
      await this.repository.setCategoryBudget({
        ledgerId: this.selectedLedgerId,
        categoryId,
        month: this.selectedMonth,
        amount,
        userId: this.authUser.id,
      })
      await this.refreshFinanceData()
      this.notify(`${this.selectedMonth} 예산을 저장했습니다.`)
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async saveMonthNote(note: string): Promise<boolean> {
    if (!this.selectedLedgerId || note.length > 1_000) {
      this.notify("월 정산 메모는 1,000자 이내로 입력해 주세요.", "error")
      return false
    }
    try {
      await this.repository.saveMonthNote(
        this.selectedLedgerId,
        this.selectedMonth,
        note.trim(),
        this.selectedMonthNote?.id,
      )
      await this.refreshFinanceData()
      this.notify("월 정산 메모를 저장했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async createCard(input: {
    name: string
    issuer: string
    last4?: string
    paymentDay: number
    billingPeriodEndDay: number
    billingPeriodEndMonthOffset: -1 | 0
    isDebit: boolean
  }): Promise<boolean> {
    if (!this.authUser || !input.name.trim() || !input.issuer.trim()) {
      this.notify("카드사와 카드 별칭을 입력해 주세요.", "error")
      return false
    }
    if (
      !Number.isSafeInteger(input.paymentDay) ||
      input.paymentDay < 1 ||
      input.paymentDay > 31 ||
      !Number.isSafeInteger(input.billingPeriodEndDay) ||
      input.billingPeriodEndDay < 1 ||
      input.billingPeriodEndDay > 31
    ) {
      this.notify("결제일과 이용기간 종료일을 확인해 주세요.", "error")
      return false
    }
    try {
      await this.repository.createCard({
        ...input,
        name: input.name.trim(),
        issuer: input.issuer.trim(),
      })
      await this.refreshFinanceData()
      this.notify(
        "내 카드에 등록했습니다. 가계부 관리에서 사용할 가계부에 연결해 주세요.",
      )
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async updateCard(
    cardId: string,
    input: {
      name: string
      issuer: string
      last4?: string
      paymentDay: number
      billingPeriodEndDay: number
      billingPeriodEndMonthOffset: -1 | 0
      isDebit: boolean
    },
  ): Promise<boolean> {
    const card = this.myPaymentInstruments.find(
      (item) => item.id === cardId && item.type === "card",
    )
    if (!card || !input.name.trim() || !input.issuer.trim()) {
      this.notify("카드사와 카드 별칭을 입력해 주세요.", "error")
      return false
    }
    if (
      !Number.isSafeInteger(input.paymentDay) ||
      input.paymentDay < 1 ||
      input.paymentDay > 31 ||
      !Number.isSafeInteger(input.billingPeriodEndDay) ||
      input.billingPeriodEndDay < 1 ||
      input.billingPeriodEndDay > 31
    ) {
      this.notify("결제일과 이용기간 종료일을 확인해 주세요.", "error")
      return false
    }
    try {
      await this.repository.updateCard(cardId, {
        ...input,
        name: input.name.trim(),
        issuer: input.issuer.trim(),
      })
      await this.refreshFinanceData()
      this.notify("카드를 수정했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async setCardActive(cardId: string, isActive: boolean): Promise<void> {
    try {
      await this.repository.setCardActive(cardId, isActive)
      await this.refreshFinanceData()
      this.notify(
        isActive ? "카드를 다시 활성화했습니다." : "카드를 비활성화했습니다.",
      )
    } catch (error) {
      this.setDataError(error)
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    try {
      await this.repository.deleteCard(cardId)
      await this.refreshFinanceData()
      this.notify("카드를 삭제하고 모든 가계부 연결을 해제했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async createAccount(input: {
    name: string
    bank: string
    last4?: string
  }): Promise<boolean> {
    if (
      !this.authUser ||
      !input.name.trim() ||
      !input.bank.trim() ||
      (input.last4 && !/^\d{4}$/.test(input.last4))
    ) {
      this.notify("은행과 계좌 별칭을 확인해 주세요.", "error")
      return false
    }

    try {
      await this.repository.createAccount({
        ...input,
        name: input.name.trim(),
        bank: input.bank.trim(),
      })
      await this.refreshFinanceData()
      this.notify(
        "내 계좌에 등록했습니다. 가계부 관리에서 사용할 가계부에 연결해 주세요.",
      )
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async updateAccount(
    accountId: string,
    input: {
      name: string
      bank: string
      last4?: string
    },
  ): Promise<boolean> {
    const account = this.myPaymentInstruments.find(
      (item) => item.id === accountId && item.type === "bank",
    )
    if (
      !account ||
      !input.name.trim() ||
      !input.bank.trim() ||
      (input.last4 && !/^\d{4}$/.test(input.last4))
    ) {
      this.notify("은행과 계좌 별칭을 확인해 주세요.", "error")
      return false
    }

    try {
      await this.repository.updateAccount(accountId, {
        ...input,
        name: input.name.trim(),
        bank: input.bank.trim(),
      })
      await this.refreshFinanceData()
      this.notify("계좌를 수정했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async setAccountActive(accountId: string, isActive: boolean): Promise<void> {
    try {
      await this.repository.setAccountActive(accountId, isActive)
      await this.refreshFinanceData()
      this.notify(
        isActive ? "계좌를 다시 활성화했습니다." : "계좌를 비활성화했습니다.",
      )
    } catch (error) {
      this.setDataError(error)
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      await this.repository.deleteAccount(accountId)
      await this.refreshFinanceData()
      this.notify("계좌를 삭제하고 모든 가계부 연결을 해제했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async endFixedRule(
    ruleId: string,
    timing: "current" | "next" = "current",
  ): Promise<void> {
    try {
      await this.repository.deactivateFixedRule(
        ruleId,
        timing === "current"
          ? this.selectedMonth
          : moveMonth(this.selectedMonth, 1),
      )
      await this.refreshFinanceData()
      this.notify(
        timing === "current"
          ? "이번 달부터 고정 거래를 종료했습니다."
          : "다음 달부터 고정 거래를 종료했습니다.",
      )
    } catch (error) {
      this.setDataError(error)
    }
  }

  async deleteInstallmentOccurrences(
    ruleId: string,
    installmentNumber: number,
    scope: InstallmentDeleteScope,
  ): Promise<boolean> {
    try {
      await this.repository.deleteInstallmentOccurrences(
        ruleId,
        installmentNumber,
        scope,
      )
      await this.refreshFinanceData()
      const message = {
        single: "선택한 할부 회차를 삭제했습니다.",
        future: "다음 회차부터 할부를 종료했습니다.",
        current_and_future: "선택한 회차부터 할부를 종료했습니다.",
        all: "할부 거래 전체를 삭제했습니다.",
      } satisfies Record<InstallmentDeleteScope, string>
      this.notify(message[scope])
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async createLedger(input: LedgerCreationInput): Promise<boolean> {
    const name = input.name.trim()
    if (!this.authUser) {
      return false
    }

    if (!name) {
      this.notify("가계부 이름을 입력해 주세요.", "error")
      return false
    }

    if (name.length > 30) {
      this.notify("가계부 이름은 30자 이내로 입력해 주세요.", "error")
      return false
    }

    if (this.ledgerMutationState !== "idle") return false
    this.ledgerMutationState = "creating"

    try {
      const ledgerId = await this.repository.createLedger({
        ...input,
        name,
      })
      await this.refreshFinanceData()
      if (this.dataState !== "ready") return false
      runInAction(() => {
        this.selectedLedgerId = ledgerId
      })
      this.notify(
        `${input.type === "shared" ? "공동" : "개인"} 가계부를 만들었습니다.`,
      )
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  async renameCurrentLedger(name: string): Promise<boolean> {
    const trimmed = name.trim()
    const ledger = this.currentLedger
    const canRename =
      Boolean(this.authUser && ledger) &&
      (ledger?.type === "personal"
        ? ledger.ownerId === this.authUser?.id
        : ledger?.role === "owner" || ledger?.role === "admin")

    if (!ledger || !canRename) {
      this.notify("가계부 이름을 변경할 권한이 없습니다.", "error")
      return false
    }

    if (!trimmed) {
      this.notify("가계부 이름을 입력해 주세요.", "error")
      return false
    }

    if (trimmed.length > 30) {
      this.notify("가계부 이름은 30자 이내로 입력해 주세요.", "error")
      return false
    }

    if (trimmed === ledger.name) return true
    if (this.ledgerMutationState !== "idle") return false
    this.ledgerMutationState = "renaming"

    try {
      await this.repository.renameLedger(ledger.id, trimmed)
      await this.refreshFinanceData()
      if (this.dataState !== "ready") return false
      this.notify("가계부 이름을 변경했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  async convertCurrentLedgerToShared(): Promise<boolean> {
    if (
      !this.authUser ||
      !this.currentLedger ||
      this.currentLedger.type !== "personal" ||
      this.currentLedger.ownerId !== this.authUser.id
    ) {
      return false
    }

    try {
      await this.repository.convertPersonalLedgerToShared(this.currentLedger.id)
      await this.refreshFinanceData()
      this.notify("개인 가계부를 공동 가계부로 전환했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async archiveCurrentLedger(): Promise<boolean> {
    const ledger = this.currentLedger
    if (!ledger || ledger.ownerId !== this.authUser?.id) return false
    if (this.currentMembership?.isDefault) {
      this.notify(
        "다른 가계부를 기본 가계부로 설정한 후 제거할 수 있습니다.",
        "error",
      )
      return false
    }
    if (this.ledgerMutationState !== "idle") return false
    this.ledgerMutationState = "archiving"
    try {
      await this.repository.archiveLedger(ledger.id)
      await this.refreshFinanceData()
      this.notify("가계부를 제거했습니다. 30일 동안 복구할 수 있습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  async restoreLedger(ledgerId: string): Promise<boolean> {
    if (this.ledgerMutationState !== "idle") return false
    this.ledgerMutationState = "restoring"
    try {
      await this.repository.restoreLedger(ledgerId)
      await this.refreshFinanceData()
      runInAction(() => {
        this.selectedLedgerId = ledgerId
      })
      this.notify("가계부를 복구했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  async leaveCurrentSharedLedger(): Promise<boolean> {
    const ledger = this.currentLedger
    if (!ledger || ledger.type !== "shared" || ledger.role === "owner") {
      return false
    }
    try {
      await this.repository.leaveSharedLedger(ledger.id)
      await this.refreshFinanceData()
      this.notify("공동 가계부에서 나왔습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async createInvite(
    roleToGrant: Exclude<LedgerRole, "owner"> = "member",
  ): Promise<CreatedLedgerInvitation | null> {
    if (
      !this.authUser ||
      !this.selectedLedgerId ||
      this.currentLedger?.type !== "shared"
    )
      return null

    try {
      const invitation = await this.repository.createInvite(
        this.selectedLedgerId,
        roleToGrant,
      )
      await this.refreshFinanceData()
      this.notify("초대 코드를 만들었습니다.")
      return invitation
    } catch (error) {
      this.setDataError(error)
      return null
    }
  }

  async updateMemberRole(
    targetUserId: string,
    role: Exclude<LedgerRole, "owner">,
  ): Promise<boolean> {
    if (!this.currentLedger || this.currentLedger.role !== "owner") return false
    try {
      await this.repository.updateLedgerMemberRole(
        this.currentLedger.id,
        targetUserId,
        role,
      )
      await this.refreshFinanceData()
      this.notify("멤버 역할을 변경했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async removeMember(targetUserId: string): Promise<boolean> {
    if (!this.currentLedger) return false
    try {
      await this.repository.removeLedgerMember(
        this.currentLedger.id,
        targetUserId,
      )
      await this.refreshFinanceData()
      this.notify("멤버를 공동 가계부에서 내보냈습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async transferLedgerOwnership(targetUserId: string): Promise<boolean> {
    if (!this.currentLedger || this.currentLedger.role !== "owner") return false
    try {
      await this.repository.transferLedgerOwnership(
        this.currentLedger.id,
        targetUserId,
      )
      await this.refreshFinanceData()
      this.notify("가계부 소유권을 이전했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async acceptInvite(
    inviteCode: string,
  ): Promise<AcceptLedgerInviteResult | null> {
    const normalizedCode = inviteCode.trim().toUpperCase()
    if (!this.authUser || !normalizedCode) return null

    try {
      const result = await this.repository.acceptInvite(normalizedCode)
      if (result.status === "invalid_or_expired") {
        this.notify("유효하지 않거나 만료된 초대 코드입니다.", "error")
        return result
      }
      await this.refreshFinanceData()
      runInAction(() => {
        this.selectedLedgerId = result.ledgerId
      })
      this.notify(
        result.status === "already_member"
          ? "이미 참여 중인 가계부입니다. 해당 가계부로 이동했습니다."
          : "공동 가계부에 참여했습니다. 내 카드·계좌를 연결해 주세요.",
        result.status === "already_member" ? "info" : "success",
      )
      return result
    } catch (error) {
      this.setDataError(error)
      return null
    }
  }

  async syncMyLedgerPaymentMethods(
    paymentInstrumentIds: string[],
    ledgerVisibleInstrumentIds: string[],
    primaryInstrumentId?: string,
  ): Promise<boolean> {
    if (!this.currentLedger) return false
    if (this.ledgerMutationState !== "idle") return false
    this.ledgerMutationState = "syncing-payment-methods"
    try {
      await this.repository.syncMyLedgerPaymentMethods(
        this.currentLedger.id,
        paymentInstrumentIds,
        this.currentLedger.type === "shared" ? ledgerVisibleInstrumentIds : [],
        primaryInstrumentId,
      )
      await this.refreshFinanceData()
      this.notify("이 가계부에 연결할 내 카드·계좌를 저장했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    } finally {
      runInAction(() => {
        this.ledgerMutationState = "idle"
      })
    }
  }

  async revokeInvite(invitationId: string): Promise<void> {
    try {
      await this.repository.revokeInvite(invitationId)
      await this.refreshFinanceData()
      this.notify("초대를 취소했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async requestAccountDeletion(): Promise<boolean> {
    try {
      const purgeAfter = await this.repository.requestAccountDeletion()
      await this.refreshFinanceData()
      this.notify(
        `${new Date(purgeAfter).toLocaleDateString("ko-KR")}에 계정이 삭제됩니다. 그 전까지 취소할 수 있습니다.`,
        "info",
      )
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async acceptLegalTerms(): Promise<boolean> {
    try {
      await this.repository.acceptLegalTerms(
        CURRENT_TERMS_VERSION,
        CURRENT_PRIVACY_VERSION,
      )
      await this.refreshFinanceData()
      this.notify("약관과 개인정보 처리방침 동의를 기록했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async cancelAccountDeletion(): Promise<boolean> {
    try {
      await this.repository.cancelAccountDeletion()
      await this.refreshFinanceData()
      this.notify("계정 삭제 요청을 취소했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async importTransactions(transactions: Transaction[]): Promise<number> {
    if (!this.authUser || !this.selectedLedgerId) return 0
    const existingKeys = new Set(
      this.data.transactions
        .filter(
          (item) => item.ledgerId === this.selectedLedgerId && !item.deletedAt,
        )
        .map(transactionDuplicateKey),
    )
    const categoryIds = new Set(this.currentCategories.map((item) => item.id))
    const paymentMethodIds = new Set(
      this.currentPaymentMethods.map((item) => item.id),
    )
    const memberIds = new Set(this.currentMembers.map((item) => item.userId))
    const valid = transactions
      .filter(
        (item) =>
          Boolean(item && typeof item === "object") &&
          (item.type === "expense" ||
            item.type === "income" ||
            item.type === "saving") &&
          (item.status === "confirmed" || item.status === "excluded") &&
          Number.isSafeInteger(item.amount) &&
          item.amount > 0 &&
          typeof item.transactionAt === "string" &&
          !Number.isNaN(Date.parse(item.transactionAt)),
      )
      .filter((item) => {
        const key = transactionDuplicateKey(item)
        if (existingKeys.has(key)) return false
        existingKeys.add(key)
        return true
      })
      .slice(0, 2_000)
      .map((item) => ({
        ...item,
        categoryId:
          item.categoryId && categoryIds.has(item.categoryId)
            ? item.categoryId
            : findOtherCategory(this.currentCategories, this.selectedLedgerId)
                ?.id,
        paymentMethodId:
          item.paymentMethodId && paymentMethodIds.has(item.paymentMethodId)
            ? item.paymentMethodId
            : undefined,
        actorUserId:
          item.actorUserId && memberIds.has(item.actorUserId)
            ? item.actorUserId
            : undefined,
        merchantName:
          typeof item.merchantName === "string"
            ? item.merchantName.trim().slice(0, 100)
            : undefined,
        memo:
          typeof item.memo === "string"
            ? item.memo.trim().slice(0, 500)
            : undefined,
        tags: Array.isArray(item.tags)
          ? [
              ...new Set(
                item.tags
                  .filter((tag): tag is string => typeof tag === "string")
                  .map((tag) => tag.trim().slice(0, 20))
                  .filter(Boolean),
              ),
            ].slice(0, 10)
          : [],
      }))
    if (valid.length === 0) {
      this.notify("복원할 새 거래가 없습니다.", "info")
      return 0
    }
    try {
      await this.repository.importTransactions(
        this.authUser.id,
        this.selectedLedgerId,
        valid,
      )
      await this.refreshFinanceData()
      this.notify(`${valid.length}건의 거래를 복원했습니다.`)
      return valid.length
    } catch (error) {
      this.setDataError(error)
      return 0
    }
  }

  detectSmsCandidate(rawText: string): void {
    const parsed = parseCardSmsText(rawText, new Date(), {
      sourceApp: "messages",
      targetLedgerId: this.selectedLedgerId,
    })

    if (
      this.data.smsCandidates.some(
        (candidate) => candidate.sourceHash === parsed.normalizedHash,
      )
    ) {
      return
    }

    const now = new Date()
    this.data.smsCandidates.unshift({
      id: createId("sms"),
      userId: this.profile.id,
      targetLedgerId: this.selectedLedgerId,
      sourceHash: parsed.normalizedHash,
      sourceApp: "messages",
      rawMessage: rawText,
      maskedMessage: parsed.rawTextMasked ?? maskSensitiveText(rawText),
      parsed,
      status: parsed.confidence >= 0.85 ? "notified" : "needs_review",
      promptCount: 1,
      firstDetectedAt: now.toISOString(),
      lastPromptedAt: now.toISOString(),
      reviewDeadlineAt: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
  }

  markSmsCandidateLater(candidateId: string): void {
    this.data.smsCandidates = this.data.smsCandidates.map((candidate) =>
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

  ignoreSmsCandidate(candidateId: string): void {
    this.data.smsCandidates = this.data.smsCandidates.map((candidate) =>
      candidate.id === candidateId
        ? { ...candidate, status: "ignored" }
        : candidate,
    )
  }

  async registerSmsCandidate(
    candidateId: string,
    categoryId?: string,
  ): Promise<void> {
    const candidate = this.data.smsCandidates.find(
      (item) => item.id === candidateId,
    )
    if (!candidate) {
      return
    }

    const parsed = candidate.parsed
    const date = new Date(parsed.transactionAt)
    const saved = await this.saveTransaction({
      ledgerId: candidate.targetLedgerId ?? this.selectedLedgerId,
      type: parsed.type,
      incomeKind: parsed.type === "income" ? "side_income" : undefined,
      status: "confirmed",
      amount: parsed.amount,
      transactionAt: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(
        2,
        "0",
      )}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      categoryId,
      merchantName: parsed.merchantName,
      memo: "카드 문자 후보",
      sourceType: "android_sms_notification",
      sourceHash: candidate.sourceHash,
      parseConfidence: parsed.confidence,
    })

    if (saved) {
      runInAction(() => {
        this.data.smsCandidates = this.data.smsCandidates.map((item) =>
          item.id === candidateId
            ? {
                ...item,
                status: categoryId ? "registered" : "auto_registered_other",
              }
            : item,
        )
      })
    }
  }

  async submitCardMessageSample(input: {
    cardCompanyName?: string
    message: string
    expectedAmount?: number
    expectedMerchantName?: string
    expectedTransactionAt?: string
  }): Promise<boolean> {
    if (!this.authUser) return false

    const parsed = parseCardSmsText(input.message)
    try {
      await this.repository.submitCardMessageSample(this.authUser.id, {
        cardCompanyName: input.cardCompanyName,
        maskedMessage: maskSensitiveText(input.message),
        expectedAmount: input.expectedAmount,
        expectedMerchantName: input.expectedMerchantName,
        expectedTransactionAt: input.expectedTransactionAt,
        parseResult: parsed,
      })
      await this.refreshFinanceData()
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  private async applyAuthSession(
    session: AuthSessionInfo | null,
  ): Promise<void> {
    if (!session) {
      this.authUser = null
      this.authState = "anonymous"
      this.initializedProfileUserId = null
      this.profileInitialization = null
      this.hydrate(createEmptyFinanceData())
      this.invalidateMonthCache()
      this.transactionMutationState = "idle"
      this.dataState = "idle"
      return
    }

    this.authUser = session.user
    this.authState = "authenticated"
    this.authError = null

    try {
      await this.ensureProfile(session.user.id)
    } catch (error) {
      await this.rejectAuthSession(session.user.id, error)
      return
    }

    await Promise.all([this.refreshFinanceData(), this.checkSupabase()])
  }

  private setAuthError(error: unknown): void {
    this.authState = "error"
    this.authError =
      error instanceof Error
        ? error.message
        : "인증 처리 중 알 수 없는 오류가 발생했습니다."
  }

  private setDataError(error: unknown): void {
    this.dataState = "error"
    this.dataError =
      error instanceof Error
        ? error.message
        : "가계부 데이터를 저장하지 못했습니다."
    this.notify(this.dataError, "error")
  }

  private applyOptimisticTransaction(
    transactionId: string,
    input: RemoteTransactionInput,
    userId: string,
  ): void {
    const existing = this.data.transactions.find(
      (transaction) => transaction.id === transactionId,
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
    const existingSplits = this.data.transactionSplits.filter(
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

    this.data = {
      ...this.data,
      transactions: [
        transaction,
        ...this.data.transactions.filter((item) => item.id !== transactionId),
      ],
      transactionSplits: [
        ...transactionSplits,
        ...this.data.transactionSplits.filter(
          (split) => split.transactionId !== transactionId,
        ),
      ],
    }
    const month = toMonthKey(new Date(input.transactionAt))
    this.setMonthCache(month, selectMonthData(this.data, month))
  }

  private async rejectAuthSession(
    userId: string,
    error: unknown,
  ): Promise<void> {
    try {
      await clearLocalAuthSession()
    } catch {
      // Keep the original initialization error visible.
    }

    runInAction(() => {
      if (this.authUser && this.authUser.id !== userId) return

      this.authUser = null
      this.initializedProfileUserId = null
      this.profileInitialization = null
      this.hydrate(createEmptyFinanceData())
      this.invalidateMonthCache()
      this.transactionMutationState = "idle"
      this.dataState = "idle"
      this.setAuthError(error)
    })
  }

  private async ensureProfile(userId: string): Promise<void> {
    if (this.initializedProfileUserId !== userId) {
      this.initializedProfileUserId = userId
      this.profileInitialization = ensureAuthenticatedProfile().then(
        () => undefined,
      )
    }

    const initialization = this.profileInitialization
    try {
      await initialization
    } catch (error) {
      runInAction(() => {
        if (this.initializedProfileUserId === userId) {
          this.initializedProfileUserId = null
        }
      })
      throw error
    } finally {
      runInAction(() => {
        if (this.profileInitialization === initialization) {
          this.profileInitialization = null
        }
      })
    }
  }
}

function createKoreaMonthTransactionRange(month: string): TransactionDateRange {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  const year = Number(match?.[1])
  const monthNumber = Number(match?.[2])
  if (!match || monthNumber < 1 || monthNumber > 12) {
    throw new Error("조회 월은 YYYY-MM 형식이어야 합니다.")
  }

  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return {
    start: `${month}-01T00:00:00+09:00`,
    endExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`,
  }
}

function selectMonthData(
  financeData: FinanceData,
  month: string,
): TransactionData {
  const range = createKoreaMonthTransactionRange(month)
  const start = Date.parse(range.start)
  const endExclusive = Date.parse(range.endExclusive)
  const transactions = financeData.transactions.filter((transaction) => {
    const transactionAt = Date.parse(transaction.transactionAt)
    return transactionAt >= start && transactionAt < endExclusive
  })
  const transactionIds = new Set(
    transactions.map((transaction) => transaction.id),
  )
  return {
    transactions,
    transactionSplits: financeData.transactionSplits.filter((split) =>
      transactionIds.has(split.transactionId),
    ),
  }
}

function mergeFinanceTransactionMonth(
  financeData: FinanceData,
  transactionData: TransactionData,
  month: string,
): FinanceData {
  const currentMonthData = selectMonthData(financeData, month)
  const replacedTransactionIds = new Set(
    [...currentMonthData.transactions, ...transactionData.transactions].map(
      (transaction) => transaction.id,
    ),
  )
  return {
    ...financeData,
    transactions: [
      ...transactionData.transactions,
      ...financeData.transactions.filter(
        (transaction) => !replacedTransactionIds.has(transaction.id),
      ),
    ],
    transactionSplits: [
      ...transactionData.transactionSplits,
      ...financeData.transactionSplits.filter(
        (split) => !replacedTransactionIds.has(split.transactionId),
      ),
    ],
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
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
