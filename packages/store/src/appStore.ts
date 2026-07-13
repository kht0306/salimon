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
  CategoryUsageType,
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
  recurringType?: "fixed" | "installment"
  recurringRuleId?: string
  installmentMonths?: number
  installmentAmountType?: "monthly" | "principal"
  paymentMethodId?: string
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
  transactionEditorOpen = false
  transactionEditorDirty = false
  activeView:
    | "calendar"
    | "transactions"
    | "categories"
    | "cards"
    | "settlement"
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
    return this.currentCategories.filter((category) =>
      category.usageTypes.includes("expense"),
    )
  }

  get currentCards() {
    return this.currentLedgerCards.filter((method) => method.isActive)
  }

  get currentLedgerCards() {
    return this.data.paymentMethods.filter(
      (method) =>
        method.ledgerId === this.selectedLedgerId &&
        method.type === "card" &&
        !method.isDeleted,
    )
  }

  get defaultInstallmentCard() {
    const userPrimary = this.currentCards.find(
      (card) =>
        card.ownerUserId === this.authUser?.id && Boolean(card.isPrimary),
    )
    if (userPrimary) return userPrimary

    return this.currentCards.find(
      (card) =>
        card.ownerUserId === this.currentLedger?.ownerId &&
        Boolean(card.isPrimary),
    )
  }

  get selectedMonthBudgets() {
    return this.expenseCategories.flatMap((category) => {
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
          (item) =>
            item.type === "expense" &&
            item.status !== "excluded" &&
            item.categoryId === category.id,
        )
        .reduce((sum, item) => sum + item.amount, 0)
      return [{ category, amount: budget.amount, spent }]
    })
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

  get monthSavingTotal(): number {
    return this.monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "saving" && transaction.status !== "excluded",
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
      const defaultLedgerId = this.data.members.find(
        (member) => member.userId === this.authUser?.id && member.isDefault,
      )?.ledgerId
      this.selectedLedgerId = defaultLedgerId ?? this.data.ledgers[0]?.id ?? ""
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
      await this.repository.materializeMonth(this.selectedMonth)
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

  async setDefaultLedger(ledgerId: string): Promise<boolean> {
    if (!this.authUser || !ledgerId) return false

    try {
      await this.repository.setDefaultLedger(ledgerId)
      await this.refreshFinanceData()
      this.notify("기본 가계부를 변경했습니다.")
      return this.dataState === "ready"
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  selectDate(date: string): void {
    const month = date.slice(0, 7)
    const monthChanged = month !== this.selectedMonth

    this.selectedDate = date
    if (monthChanged) {
      this.selectedMonth = month
      void this.refreshFinanceData()
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
    this.selectedMonth = moveMonth(this.selectedMonth, amount)
    void this.refreshFinanceData()
  }

  async saveTransaction(draft: TransactionDraft): Promise<boolean> {
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

    const categoryId =
      draft.categoryId ||
      (draft.type === "transfer"
        ? this.data.categories.find(
            (category) =>
              category.ledgerId === draft.ledgerId && !category.isArchived,
          )?.id
        : draft.type === "expense"
          ? findOtherCategory(this.data.categories, draft.ledgerId)?.id
          : this.data.categories.find(
              (category) =>
                category.ledgerId === draft.ledgerId &&
                category.usageTypes.includes(
                  draft.type as CategoryUsageType,
                ) &&
                !category.isArchived,
            )?.id)

    try {
      await this.repository.saveTransaction(this.authUser.id, {
        ...draft,
        categoryId,
        transactionAt: fromDateTimeLocalValue(draft.transactionAt),
      })
      await this.refreshFinanceData()
      this.notify(draft.id ? "거래를 수정했습니다." : "거래를 저장했습니다.")
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

    const duplicate = this.currentCategories.some(
      (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      this.notify("이미 같은 이름의 카테고리가 있습니다.", "error")
      return false
    }

    try {
      const categoryId = await this.repository.createCategory({
        ledgerId: this.selectedLedgerId,
        userId: this.authUser.id,
        name: trimmed,
        icon,
        color,
        sortOrder: this.currentCategories.length,
        usageTypes,
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
    patch: Partial<Pick<Category, "name" | "icon" | "color" | "usageTypes">>,
  ): Promise<boolean> {
    const category = this.data.categories.find((item) => item.id === categoryId)
    const name = patch.name?.trim()
    if (!category || (patch.name !== undefined && !name)) {
      this.notify("카테고리 이름을 입력해 주세요.", "error")
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

    if (
      name &&
      this.data.categories.some(
        (item) =>
          item.id !== categoryId &&
          item.ledgerId === category.ledgerId &&
          !item.isArchived &&
          item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      this.notify("이미 같은 이름의 카테고리가 있습니다.", "error")
      return false
    }

    try {
      await this.repository.updateCategory(categoryId, {
        ...patch,
        ...(name ? { name } : {}),
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
    if (!category || category.name === "기타") return

    try {
      await this.repository.updateCategory(categoryId, { isArchived: true })
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

    const visibleCategories = this.currentCategories
    const sourceIndex = visibleCategories.findIndex(
      (category) => category.id === sourceCategoryId,
    )
    const targetIndex = visibleCategories.findIndex(
      (category) => category.id === targetCategoryId,
    )
    if (sourceIndex < 0 || targetIndex < 0) return false

    const reorderedVisibleCategories = [...visibleCategories]
    const [movedCategory] = reorderedVisibleCategories.splice(sourceIndex, 1)
    if (!movedCategory) return false
    reorderedVisibleCategories.splice(targetIndex, 0, movedCategory)

    const archivedCategories = this.data.categories
      .filter(
        (category) =>
          category.ledgerId === this.selectedLedgerId && category.isArchived,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const orderedCategories = [
      ...reorderedVisibleCategories,
      ...archivedCategories,
    ]

    const previousOrders = new Map(
      orderedCategories.map((category) => [category.id, category.sortOrder]),
    )
    const updates = orderedCategories.map((category, index) => ({
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

  async createCard(input: {
    ownerUserId: string
    name: string
    issuer: string
    last4?: string
    paymentDay: number
    billingPeriodEndDay: number
    billingPeriodEndMonthOffset: -1 | 0
    isPrimary: boolean
    isDebit: boolean
  }): Promise<boolean> {
    if (!this.selectedLedgerId || !input.name.trim() || !input.issuer.trim()) {
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
      const isFirstCard = !this.currentLedgerCards.some(
        (card) => card.ownerUserId === input.ownerUserId,
      )
      await this.repository.createCard({
        ...input,
        ledgerId: this.selectedLedgerId,
        name: input.name.trim(),
        issuer: input.issuer.trim(),
        isPrimary: isFirstCard || input.isPrimary,
      })
      await this.refreshFinanceData()
      this.notify("카드를 등록했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async updateCard(
    cardId: string,
    input: {
      ownerUserId: string
      name: string
      issuer: string
      last4?: string
      paymentDay: number
      billingPeriodEndDay: number
      billingPeriodEndMonthOffset: -1 | 0
      isPrimary: boolean
      isDebit: boolean
    },
  ): Promise<boolean> {
    const card = this.currentLedgerCards.find((item) => item.id === cardId)
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
      const isFirstCard = !this.currentLedgerCards.some(
        (item) => item.id !== cardId && item.ownerUserId === input.ownerUserId,
      )
      await this.repository.updateCard(cardId, {
        ...input,
        name: input.name.trim(),
        issuer: input.issuer.trim(),
        isPrimary: isFirstCard || input.isPrimary,
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
      this.notify("카드를 삭제했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async setCardPrimary(cardId: string): Promise<void> {
    try {
      await this.repository.setCardPrimary(cardId)
      await this.refreshFinanceData()
      this.notify("주 카드를 변경했습니다.")
    } catch (error) {
      this.setDataError(error)
    }
  }

  async resetMyFinanceData(): Promise<boolean> {
    try {
      await this.repository.resetMyFinanceData()
      this.initializedWorkspaceUserId = null
      await this.ensureWorkspace(this.authUser?.id ?? "")
      await this.refreshFinanceData()
      this.notify("카테고리와 카드는 유지하고 테스트 데이터를 초기화했습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
    }
  }

  async deactivateFixedRule(ruleId: string): Promise<void> {
    try {
      await this.repository.deactivateFixedRule(ruleId, this.selectedMonth)
      await this.refreshFinanceData()
      this.notify("이번 달부터 고정비를 해제했습니다.")
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
      this.notify("공동 가계부를 만들었습니다.")
      return true
    } catch (error) {
      this.setDataError(error)
      return false
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
      this.notify("초대 코드를 만들었습니다.")
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
      this.notify("공동 가계부에 참여했습니다.")
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
      this.notify("초대를 취소했습니다.")
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
    this.notify(this.dataError, "error")
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

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}
