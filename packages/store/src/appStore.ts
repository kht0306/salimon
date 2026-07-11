import {
  checkSupabaseConnection,
  createEmptyFinanceData,
  ensureAuthenticatedWorkspace,
  getCurrentAuthSession,
  observeAuthSession,
  signInWithKakao,
  signOutFromSupabase,
  SupabaseFinanceRepository,
  type AuthSessionInfo,
  type AuthUserInfo,
  type FinanceData,
  type SupabaseConnectionCheck,
} from "@salimon/api-client"
import {
  findOtherCategory,
  fromDateTimeLocalValue,
  maskSensitiveText,
  moveMonth,
  parseCardSmsText,
  toDateKey,
  toMonthKey,
} from "@salimon/domain"
import { makeAutoObservable, runInAction } from "mobx"
import type {
  Category,
  Ledger,
  LedgerInvitation,
  LocalSmsCandidate,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"

export interface TransactionDraft {
  id?: string
  ledgerId: string
  type: TransactionType
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
}

export class AppStore {
  private repository: SupabaseFinanceRepository
  data: FinanceData
  selectedLedgerId: string
  selectedMonth: string
  selectedDate: string
  activeView:
    | "calendar"
    | "transactions"
    | "categories"
    | "shared"
    | "sms"
    | "samples"
    | "connection" = "calendar"
  authState: "loading" | "authenticated" | "anonymous" | "error" = "loading"
  authUser: AuthUserInfo | null = null
  authError: string | null = null
  dataState: "idle" | "loading" | "ready" | "error" = "idle"
  dataError: string | null = null
  private initializedWorkspaceUserId: string | null = null
  private workspaceInitialization: Promise<void> | null = null
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

  get currentMembers() {
    return this.data.members.filter(
      (member) =>
        member.ledgerId === this.selectedLedgerId && member.status === "active",
    )
  }

  get currentCategories(): Category[] {
    return this.data.categories
      .filter(
        (category) =>
          category.ledgerId === this.selectedLedgerId && !category.isArchived,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  get expenseCategories(): Category[] {
    return this.currentCategories.filter(
      (category) => category.type === "expense",
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

  get monthExpenseTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.status !== "excluded",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  get monthIncomeTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" && transaction.status !== "excluded",
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
      !this.data.ledgers.some((ledger) => ledger.id === this.selectedLedgerId)
    ) {
      this.selectedLedgerId = this.data.ledgers[0]?.id ?? ""
    }
  }

  async refreshFinanceData(): Promise<void> {
    if (!this.authUser) {
      this.hydrate(createEmptyFinanceData())
      this.dataState = "idle"
      return
    }

    this.dataState = "loading"
    this.dataError = null
    try {
      const data = await this.repository.load(this.authUser.id)
      runInAction(() => {
        this.hydrate(data)
        this.dataState = "ready"
      })
    } catch (error) {
      runInAction(() => {
        this.dataState = "error"
        this.dataError =
          error instanceof Error
            ? error.message
            : "가계부 데이터를 불러오지 못했습니다."
      })
    }
  }

  setView(view: AppStore["activeView"]): void {
    this.activeView = view
  }

  async checkSupabase(): Promise<void> {
    this.supabaseConnection = {
      ...this.supabaseConnection,
      state: "checking",
      message: "Supabase 연결을 확인하는 중입니다.",
    }
    const connection = await checkSupabaseConnection()
    runInAction(() => {
      this.supabaseConnection = connection
    })
  }

  async initializeAuth(): Promise<void> {
    this.authState = "loading"
    this.authError = null

    try {
      await this.applyAuthSession(await getCurrentAuthSession())
    } catch (error) {
      this.setAuthError(error)
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
        this.initializedWorkspaceUserId = null
        this.workspaceInitialization = null
        this.hydrate(createEmptyFinanceData())
        this.dataState = "idle"
      })
      await this.checkSupabase()
    } catch (error) {
      this.setAuthError(error)
    }
  }

  switchLedger(ledgerId: string): void {
    this.selectedLedgerId = ledgerId
    this.activeView = "calendar"
  }

  selectDate(date: string): void {
    this.selectedDate = date
  }

  moveSelectedMonth(amount: number): void {
    this.selectedMonth = moveMonth(this.selectedMonth, amount)
  }

  async saveTransaction(draft: TransactionDraft): Promise<boolean> {
    if (
      !this.authUser ||
      !draft.ledgerId ||
      !Number.isSafeInteger(draft.amount) ||
      draft.amount <= 0
    ) {
      return false
    }

    const categoryId =
      draft.categoryId ||
      (draft.type === "expense"
        ? findOtherCategory(this.data.categories, draft.ledgerId)?.id
        : undefined)

    try {
      await this.repository.saveTransaction(this.authUser.id, {
        ...draft,
        categoryId,
        transactionAt: fromDateTimeLocalValue(draft.transactionAt),
      })
      await this.refreshFinanceData()
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
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
    } catch (error) {
      this.setDataError(error)
    }
  }

  async createExpenseCategory(
    name: string,
    icon: string,
    color: string,
  ): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed || !this.selectedLedgerId || !this.authUser) {
      return false
    }

    const duplicate = this.expenseCategories.some(
      (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      return false
    }

    try {
      await this.repository.createExpenseCategory({
        ledgerId: this.selectedLedgerId,
        userId: this.authUser.id,
        name: trimmed,
        icon,
        color,
        sortOrder: this.expenseCategories.length,
      })
      await this.refreshFinanceData()
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async updateCategory(
    categoryId: string,
    patch: Partial<Pick<Category, "name" | "icon" | "color">>,
  ): Promise<void> {
    try {
      await this.repository.updateCategory(categoryId, patch)
      await this.refreshFinanceData()
    } catch (error) {
      this.setDataError(error)
    }
  }

  async archiveCategory(categoryId: string): Promise<void> {
    const category = this.data.categories.find((item) => item.id === categoryId)
    if (!category || category.isDefault || category.name === "기타") return

    try {
      await this.repository.updateCategory(categoryId, { isArchived: true })
      await this.refreshFinanceData()
    } catch (error) {
      this.setDataError(error)
    }
  }

  async createSharedLedger(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed || !this.authUser) {
      return false
    }

    try {
      const ledgerId = await this.repository.createSharedLedger(trimmed)
      await this.refreshFinanceData()
      runInAction(() => {
        this.selectedLedgerId = ledgerId
      })
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async createInvite(): Promise<LedgerInvitation | null> {
    if (
      !this.authUser ||
      !this.selectedLedgerId ||
      this.currentLedger?.type !== "shared"
    )
      return null

    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    try {
      await this.repository.createInvite({
        ledgerId: this.selectedLedgerId,
        userId: this.authUser.id,
        inviteCode,
        inviteTokenHash: createId("invite-token"),
      })
      await this.refreshFinanceData()
      return (
        this.data.invitations.find(
          (invitation) => invitation.inviteCode === inviteCode,
        ) ?? null
      )
    } catch (error) {
      this.setDataError(error)
      return null
    }
  }

  async acceptInvite(inviteCode: string): Promise<boolean> {
    const normalizedCode = inviteCode.trim().toUpperCase()
    if (!this.authUser || !normalizedCode) return false

    try {
      const ledgerId = await this.repository.acceptInvite(normalizedCode)
      await this.refreshFinanceData()
      runInAction(() => {
        this.selectedLedgerId = ledgerId
      })
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async revokeInvite(invitationId: string): Promise<void> {
    try {
      await this.repository.revokeInvite(invitationId)
      await this.refreshFinanceData()
    } catch (error) {
      this.setDataError(error)
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
      this.initializedWorkspaceUserId = null
      this.workspaceInitialization = null
      this.hydrate(createEmptyFinanceData())
      this.dataState = "idle"
      return
    }

    this.authUser = session.user
    this.authState = "authenticated"
    this.authError = null

    try {
      await this.ensureWorkspace(session.user.id)
    } catch (error) {
      this.setAuthError(error)
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
  }

  private async ensureWorkspace(userId: string): Promise<void> {
    if (this.initializedWorkspaceUserId !== userId) {
      this.initializedWorkspaceUserId = userId
      this.workspaceInitialization = ensureAuthenticatedWorkspace().then(
        () => undefined,
      )
    }

    const initialization = this.workspaceInitialization
    try {
      await initialization
    } catch (error) {
      runInAction(() => {
        if (this.initializedWorkspaceUserId === userId) {
          this.initializedWorkspaceUserId = null
        }
      })
      throw error
    } finally {
      runInAction(() => {
        if (this.workspaceInitialization === initialization) {
          this.workspaceInitialization = null
        }
      })
    }
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`
}
