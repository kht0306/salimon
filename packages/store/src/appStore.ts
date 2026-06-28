import { LocalFinanceRepository, type FinanceData } from "@salimon/api-client"
import {
  createCategory,
  createDefaultCategories,
  findOtherCategory,
  fromDateTimeLocalValue,
  maskSensitiveText,
  moveMonth,
  parseCardSmsText,
  toDateKey,
  toMonthKey,
} from "@salimon/domain"
import { makeAutoObservable } from "mobx"
import type {
  CardMessageSample,
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
  sourceType?: Transaction["sourceType"]
  sourceHash?: string
  parseConfidence?: number
}

export class AppStore {
  private repository: LocalFinanceRepository
  data: FinanceData
  selectedLedgerId: string
  selectedMonth: string
  selectedDate: string
  activeView: "calendar" | "categories" | "shared" | "sms" | "samples" = "calendar"

  constructor(repository = new LocalFinanceRepository()) {
    this.repository = repository
    this.data = repository.load()
    this.selectedLedgerId = this.data.ledgers[0]?.id ?? ""
    this.selectedMonth = toMonthKey(new Date())
    this.selectedDate = toDateKey(new Date())
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get profile() {
    return this.data.profile
  }

  get currentLedger(): Ledger | undefined {
    return this.data.ledgers.find((ledger) => ledger.id === this.selectedLedgerId)
  }

  get currentMembers() {
    return this.data.members.filter((member) => member.ledgerId === this.selectedLedgerId && member.status === "active")
  }

  get currentCategories(): Category[] {
    return this.data.categories
      .filter((category) => category.ledgerId === this.selectedLedgerId && !category.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  get expenseCategories(): Category[] {
    return this.currentCategories.filter((category) => category.type === "expense")
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
      .sort((a, b) => new Date(b.transactionAt).getTime() - new Date(a.transactionAt).getTime())
  }

  get selectedDateTransactions(): Transaction[] {
    return this.monthTransactions.filter(
      (transaction) => toDateKey(new Date(transaction.transactionAt)) === this.selectedDate,
    )
  }

  get monthExpenseTotal(): number {
    return this.monthTransactions
      .filter((transaction) => transaction.type === "expense" && transaction.status !== "excluded")
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  get monthIncomeTotal(): number {
    return this.monthTransactions
      .filter((transaction) => transaction.type === "income" && transaction.status !== "excluded")
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
    if (!this.data.ledgers.some((ledger) => ledger.id === this.selectedLedgerId)) {
      this.selectedLedgerId = this.data.ledgers[0]?.id ?? ""
    }
  }

  resetDemo(): void {
    this.hydrate(this.repository.reset())
    this.persist()
  }

  setView(view: AppStore["activeView"]): void {
    this.activeView = view
  }

  switchLedger(ledgerId: string): void {
    this.selectedLedgerId = ledgerId
  }

  selectDate(date: string): void {
    this.selectedDate = date
  }

  moveSelectedMonth(amount: number): void {
    this.selectedMonth = moveMonth(this.selectedMonth, amount)
  }

  saveTransaction(draft: TransactionDraft): void {
    const now = new Date().toISOString()
    const categoryId =
      draft.categoryId ||
      (draft.type === "expense" ? findOtherCategory(this.data.categories, draft.ledgerId)?.id : undefined)

    if (draft.id) {
      this.data.transactions = this.data.transactions.map((transaction) =>
        transaction.id === draft.id
          ? {
              ...transaction,
              ...draft,
              categoryId,
              transactionAt: fromDateTimeLocalValue(draft.transactionAt),
              updatedBy: this.profile.id,
              updatedAt: now,
            }
          : transaction,
      )
    } else {
      this.data.transactions.unshift({
        id: createId("tx"),
        ledgerId: draft.ledgerId,
        createdBy: this.profile.id,
        type: draft.type,
        status: draft.status,
        amount: draft.amount,
        currency: "KRW",
        transactionAt: fromDateTimeLocalValue(draft.transactionAt),
        categoryId,
        merchantName: draft.merchantName,
        memo: draft.memo,
        sourceType: draft.sourceType ?? "manual",
        sourceHash: draft.sourceHash,
        parseConfidence: draft.parseConfidence,
        createdAt: now,
        updatedAt: now,
      })
    }

    this.persist()
  }

  softDeleteTransaction(transactionId: string): void {
    const now = new Date().toISOString()
    this.data.transactions = this.data.transactions.map((transaction) =>
      transaction.id === transactionId ? { ...transaction, deletedAt: now, updatedAt: now } : transaction,
    )
    this.persist()
  }

  createExpenseCategory(name: string, icon: string, color: string): void {
    const trimmed = name.trim()
    if (!trimmed || !this.selectedLedgerId) {
      return
    }

    const duplicate = this.expenseCategories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())
    if (duplicate) {
      return
    }

    this.data.categories.push(
      createCategory(
        this.selectedLedgerId,
        this.profile.id,
        "expense",
        trimmed,
        icon,
        color,
        this.expenseCategories.length,
      ),
    )
    this.persist()
  }

  updateCategory(categoryId: string, patch: Partial<Pick<Category, "name" | "icon" | "color">>): void {
    this.data.categories = this.data.categories.map((category) =>
      category.id === categoryId ? { ...category, ...patch } : category,
    )
    this.persist()
  }

  archiveCategory(categoryId: string): void {
    this.data.categories = this.data.categories.map((category) => {
      if (category.id !== categoryId || category.isDefault || category.name === "기타") {
        return category
      }

      return { ...category, isArchived: true }
    })
    this.persist()
  }

  createSharedLedger(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }

    const ledgerId = createId("ledger")
    const now = new Date().toISOString()
    this.data.ledgers.push({
      id: ledgerId,
      ownerId: this.profile.id,
      name: trimmed,
      type: "shared",
      currency: "KRW",
      role: "owner",
    })
    this.data.members.push({
      id: createId("member"),
      ledgerId,
      userId: this.profile.id,
      nickname: this.profile.nickname,
      role: "owner",
      status: "active",
      joinedAt: now,
    })
    this.data.categories.push(...createDefaultCategories(ledgerId, this.profile.id))
    this.selectedLedgerId = ledgerId
    this.persist()
  }

  createInvite(): LedgerInvitation {
    const now = new Date()
    const invitation: LedgerInvitation = {
      id: createId("invite"),
      ledgerId: this.selectedLedgerId,
      invitedBy: this.profile.id,
      inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      roleToGrant: "member",
      status: "active",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
    this.data.invitations.unshift(invitation)
    this.persist()
    return invitation
  }

  revokeInvite(invitationId: string): void {
    this.data.invitations = this.data.invitations.map((invitation) =>
      invitation.id === invitationId ? { ...invitation, status: "revoked" } : invitation,
    )
    this.persist()
  }

  detectSmsCandidate(rawText: string): void {
    const parsed = parseCardSmsText(rawText, new Date(), {
      sourceApp: "messages",
      targetLedgerId: this.selectedLedgerId,
    })

    if (this.data.smsCandidates.some((candidate) => candidate.sourceHash === parsed.normalizedHash)) {
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
      reviewDeadlineAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    this.persist()
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
    this.persist()
  }

  ignoreSmsCandidate(candidateId: string): void {
    this.data.smsCandidates = this.data.smsCandidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, status: "ignored" } : candidate,
    )
    this.persist()
  }

  registerSmsCandidate(candidateId: string, categoryId?: string): void {
    const candidate = this.data.smsCandidates.find((item) => item.id === candidateId)
    if (!candidate) {
      return
    }

    const parsed = candidate.parsed
    const date = new Date(parsed.transactionAt)
    this.saveTransaction({
      ledgerId: candidate.targetLedgerId ?? this.selectedLedgerId,
      type: parsed.type,
      status: "confirmed",
      amount: parsed.amount,
      transactionAt: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      categoryId,
      merchantName: parsed.merchantName,
      memo: "카드 문자 후보",
      sourceType: "android_sms_notification",
      sourceHash: candidate.sourceHash,
      parseConfidence: parsed.confidence,
    })

    this.data.smsCandidates = this.data.smsCandidates.map((item) =>
      item.id === candidateId ? { ...item, status: categoryId ? "registered" : "auto_registered_other" } : item,
    )
    this.persist()
  }

  submitCardMessageSample(input: {
    cardCompanyName?: string
    message: string
    expectedAmount?: number
    expectedMerchantName?: string
    expectedTransactionAt?: string
  }): void {
    const parsed = parseCardSmsText(input.message)
    const sample: CardMessageSample = {
      id: createId("sample"),
      submittedBy: this.profile.id,
      cardCompanyName: input.cardCompanyName,
      maskedMessage: maskSensitiveText(input.message),
      expectedAmount: input.expectedAmount,
      expectedMerchantName: input.expectedMerchantName,
      expectedTransactionAt: input.expectedTransactionAt,
      parseResult: parsed,
      consentVersion: "2026-06-28",
      status: "submitted",
      createdAt: new Date().toISOString(),
    }
    this.data.cardMessageSamples.unshift(sample)
    this.persist()
  }

  private persist(): void {
    this.repository.save(this.data)
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`
}
