import type {
  CardMessageSample,
  Category,
  CategoryBudget,
  CategoryUsageType,
  IncomeKind,
  InstallmentDeleteScope,
  Ledger,
  LedgerInvitation,
  LedgerMember,
  LedgerMemberEvent,
  LedgerMonthNote,
  LedgerRole,
  LedgerType,
  LegalConsent,
  PaymentMethod,
  PaymentInstrument,
  Profile,
  RecurringRule,
  Transaction,
  TransactionSourceType,
  TransactionStatus,
  TransactionSplit,
  TransactionType,
} from "@salimon/types"
import type { FinanceData } from "./financeData"
import {
  getSupabaseBrowserClient,
  type SalimonSupabaseClient,
} from "./supabaseClient"

type Row = Record<string, unknown>

export interface RemoteTransactionInput {
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
  sourceType?: TransactionSourceType
  sourceApp?: string
  sourceSender?: string
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

export interface RemoteSampleInput {
  cardCompanyName?: string
  maskedMessage: string
  expectedAmount?: number
  expectedMerchantName?: string
  expectedTransactionAt?: string
  parseResult?: object
}

export interface CreatedLedgerInvitation {
  id: string
  inviteCode: string
  expiresAt: string
}

export type AcceptLedgerInviteResult =
  | { status: "accepted"; ledgerId: string }
  | { status: "already_member"; ledgerId: string }
  | { status: "invalid_or_expired" }

export interface TransactionDateRange {
  start: string
  endExclusive: string
}

export interface FinanceLoadOptions {
  transactionDateRange?: TransactionDateRange
}

export interface FinanceMutationOptions {
  signal?: AbortSignal
}

export interface TransactionData {
  transactions: Transaction[]
  transactionSplits: TransactionSplit[]
}

export interface TransactionRequestResult {
  recurringRuleId?: string
  transactionId?: string
}

export class DuplicateTransactionSourceError extends Error {
  constructor() {
    super("이미 등록된 알림 거래입니다.")
    this.name = "DuplicateTransactionSourceError"
  }
}

export function createTransactionRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16)
    const value = token === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export class SupabaseFinanceRepository {
  constructor(private readonly client?: SalimonSupabaseClient) {}

  async load(
    userId: string,
    options: FinanceLoadOptions = {},
  ): Promise<FinanceData> {
    const client = this.requireClient()
    validateTransactionDateRange(options.transactionDateRange)
    const [
      profileResult,
      ledgersResult,
      membersResult,
      memberEventsResult,
      categoriesResult,
      categoryUsagesResult,
      budgetsResult,
      rulesResult,
      paymentMethodsResult,
      paymentInstrumentsResult,
      transactionsResult,
      invitationsResult,
      samplesResult,
      deletionRequestResult,
      legalConsentResult,
      monthNotesResult,
    ] = await Promise.all([
      client
        .from("profiles")
        .select(
          "id, kakao_id, nickname, avatar_url, default_currency, timezone",
        )
        .single(),
      client
        .from("ledgers")
        .select("id, owner_id, name, type, currency, archived_at, purge_after")
        .order("created_at"),
      client
        .from("ledger_members")
        .select(
          "id, ledger_id, user_id, nickname, role, status, is_default, joined_at",
        )
        .order("joined_at"),
      client
        .from("ledger_member_events")
        .select(
          "id, ledger_id, actor_user_id, target_user_id, action, previous_role, next_role, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("categories")
        .select(
          "id, ledger_id, created_by, type, name, icon, color, sort_order, is_default, is_archived, parent_category_id",
        )
        .order("sort_order"),
      client.from("category_usage_types").select("category_id, usage_type"),
      client
        .from("category_budgets")
        .select(
          "id, ledger_id, category_id, effective_month, amount, created_at",
        )
        .order("effective_month"),
      client
        .from("recurring_rules")
        .select(
          "id, ledger_id, created_by, rule_type, transaction_type, income_kind, amount, day_of_month, time_of_day, start_month, end_month, inactive_from_month, installment_months, installment_amount_type, installment_principal, purchase_at, payment_method_id, category_id, merchant_name, memo, is_active, created_at",
        )
        .order("created_at"),
      client
        .from("payment_methods")
        .select(
          "id, payment_instrument_id, ledger_id, owner_user_id, name, type, last4, issuer, visibility, is_active, is_primary, is_debit, deleted_at, payment_day, billing_period_end_day, billing_period_end_month_offset",
        )
        .in("type", ["card", "bank"])
        .order("created_at"),
      client
        .from("user_payment_methods")
        .select(
          "id, owner_user_id, name, type, last4, issuer, is_active, is_debit, deleted_at, payment_day, billing_period_end_day, billing_period_end_month_offset",
        )
        .in("type", ["card", "bank"])
        .order("created_at"),
      fetchAllTransactionRows(client, options.transactionDateRange),
      client
        .from("ledger_invitations")
        .select(
          "id, ledger_id, invited_by, invite_code, role_to_grant, status, expires_at, created_at",
        )
        .order("created_at", { ascending: false }),
      client
        .from("card_message_samples")
        .select(
          "id, submitted_by, card_company_name, masked_message, expected_amount, expected_merchant_name, expected_transaction_at, parse_result, consent_version, status, created_at",
        )
        .order("created_at", { ascending: false }),
      client
        .from("account_deletion_requests")
        .select("user_id, requested_at, purge_after")
        .maybeSingle(),
      client
        .from("legal_consents")
        .select("user_id, terms_version, privacy_version, accepted_at")
        .maybeSingle(),
      client
        .from("ledger_month_notes")
        .select("id, ledger_id, month, note, updated_by, updated_at")
        .order("month", { ascending: false }),
    ])

    const results = [
      profileResult,
      ledgersResult,
      membersResult,
      memberEventsResult,
      categoriesResult,
      categoryUsagesResult,
      budgetsResult,
      rulesResult,
      paymentMethodsResult,
      paymentInstrumentsResult,
      transactionsResult,
      invitationsResult,
      samplesResult,
      deletionRequestResult,
      legalConsentResult,
      monthNotesResult,
    ]
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      throw toError(failed.error, "가계부 데이터를 불러오지 못했습니다.")
    }

    const transactionIds = options.transactionDateRange
      ? ((transactionsResult.data ?? []) as Row[])
          .map((row) => stringValue(row.id))
          .filter((id) => id.length > 0)
      : undefined
    const transactionSplitsResult = await fetchAllTransactionSplitRows(
      client,
      transactionIds,
    )
    if (transactionSplitsResult.error) {
      throw toError(
        transactionSplitsResult.error,
        "거래 분할 데이터를 불러오지 못했습니다.",
      )
    }

    const profile = mapProfile(profileResult.data as Row)
    const members = ((membersResult.data ?? []) as Row[]).map((row) =>
      mapMember(row, profile, userId),
    )
    const categoryUsages = new Map<string, CategoryUsageType[]>()
    ;((categoryUsagesResult.data ?? []) as Row[]).forEach((row) => {
      const categoryId = stringValue(row.category_id)
      const usageType = mapCategoryUsageType(row.usage_type)
      if (!categoryId || !usageType) return
      categoryUsages.set(categoryId, [
        ...(categoryUsages.get(categoryId) ?? []),
        usageType,
      ])
    })

    return {
      profile,
      ledgers: ((ledgersResult.data ?? []) as Row[]).map((row) =>
        mapLedger(row, members, userId),
      ),
      members,
      memberEvents: ((memberEventsResult.data ?? []) as Row[]).map(
        mapMemberEvent,
      ),
      invitations: ((invitationsResult.data ?? []) as Row[]).map(mapInvitation),
      categories: ((categoriesResult.data ?? []) as Row[]).map((row) =>
        mapCategory(row, categoryUsages.get(stringValue(row.id))),
      ),
      categoryBudgets: ((budgetsResult.data ?? []) as Row[]).map(
        mapCategoryBudget,
      ),
      monthNotes: ((monthNotesResult.data ?? []) as Row[]).map(mapMonthNote),
      recurringRules: ((rulesResult.data ?? []) as Row[]).map(mapRecurringRule),
      paymentMethods: ((paymentMethodsResult.data ?? []) as Row[]).map(
        mapPaymentMethod,
      ),
      paymentInstruments: ((paymentInstrumentsResult.data ?? []) as Row[]).map(
        mapPaymentInstrument,
      ),
      transactions: ((transactionsResult.data ?? []) as Row[]).map(
        mapTransaction,
      ),
      transactionSplits: ((transactionSplitsResult.data ?? []) as Row[]).map(
        mapTransactionSplit,
      ),
      smsCandidates: [],
      cardMessageSamples: ((samplesResult.data ?? []) as Row[]).map(mapSample),
      accountDeletionRequest: deletionRequestResult.data
        ? {
            userId: stringValue((deletionRequestResult.data as Row).user_id),
            requestedAt: stringValue(
              (deletionRequestResult.data as Row).requested_at,
            ),
            purgeAfter: stringValue(
              (deletionRequestResult.data as Row).purge_after,
            ),
          }
        : undefined,
      legalConsent: legalConsentResult.data
        ? mapLegalConsent(legalConsentResult.data as Row)
        : undefined,
    }
  }

  async loadTransactions(
    transactionDateRange: TransactionDateRange,
  ): Promise<TransactionData> {
    const client = this.requireClient()
    validateTransactionDateRange(transactionDateRange)
    const transactionsResult = await fetchAllTransactionRows(
      client,
      transactionDateRange,
    )
    if (transactionsResult.error) {
      throw toError(transactionsResult.error, "월 거래를 불러오지 못했습니다.")
    }

    const transactionRows = (transactionsResult.data ?? []) as Row[]
    const transactionIds = transactionRows
      .map((row) => stringValue(row.id))
      .filter((id) => id.length > 0)
    const transactionSplitsResult = await fetchAllTransactionSplitRows(
      client,
      transactionIds,
    )
    if (transactionSplitsResult.error) {
      throw toError(
        transactionSplitsResult.error,
        "거래 분할 데이터를 불러오지 못했습니다.",
      )
    }

    return {
      transactions: transactionRows.map(mapTransaction),
      transactionSplits: ((transactionSplitsResult.data ?? []) as Row[]).map(
        mapTransactionSplit,
      ),
    }
  }

  async findTransactionRequest(
    requestId: string,
  ): Promise<TransactionRequestResult> {
    const client = this.requireClient()
    const [transactionResult, recurringRuleResult] = await Promise.all([
      client
        .from("transactions")
        .select("id")
        .eq("id", requestId)
        .maybeSingle(),
      client
        .from("recurring_rules")
        .select("id")
        .eq("id", requestId)
        .maybeSingle(),
    ])
    if (transactionResult.error) {
      throw toError(
        transactionResult.error,
        "거래 저장 결과를 확인하지 못했습니다.",
      )
    }
    if (recurringRuleResult.error) {
      throw toError(
        recurringRuleResult.error,
        "반복 거래 저장 결과를 확인하지 못했습니다.",
      )
    }

    const transactionRow = transactionResult.data as Row | null
    const recurringRuleRow = recurringRuleResult.data as Row | null
    return {
      transactionId: transactionRow
        ? optionalString(transactionRow.id)
        : undefined,
      recurringRuleId: recurringRuleRow
        ? optionalString(recurringRuleRow.id)
        : undefined,
    }
  }

  private requireClient(): SalimonSupabaseClient {
    return this.client ?? requireSupabaseClient()
  }

  async saveTransaction(
    userId: string,
    input: RemoteTransactionInput,
    options: FinanceMutationOptions = {},
  ): Promise<string | undefined> {
    const client = this.requireClient()
    const payload = {
      ledger_id: input.ledgerId,
      type: input.type,
      status: input.status,
      amount: input.amount,
      transaction_at: input.transactionAt,
      category_id: input.categoryId ?? null,
      merchant_name: input.merchantName ?? null,
      memo: input.memo ?? null,
      actor_user_id: input.actorUserId || null,
      payment_method_id: input.paymentMethodId ?? null,
      source_type: input.sourceType ?? "manual",
      source_app: input.sourceApp ?? null,
      source_sender: input.sourceSender ?? null,
      source_hash: input.sourceHash ?? null,
      parse_confidence: input.parseConfidence ?? null,
      tags: input.tags ?? [],
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const updateRequest = client.rpc(
        "update_transaction_with_recurrence_v3",
        {
          p_transaction_id: input.id,
          p_ledger_id: input.ledgerId,
          p_amount: input.amount,
          p_transaction_at: input.transactionAt,
          p_category_id: input.categoryId ?? null,
          p_merchant_name: input.merchantName ?? null,
          p_memo: input.memo ?? null,
          p_actor_user_id: input.actorUserId ?? null,
          p_status: input.status,
          p_type: input.type,
          p_income_kind: input.incomeKind ?? null,
          p_payment_method_id: input.paymentMethodId ?? null,
          p_recurring_type: input.recurringType ?? null,
          p_installment_months: input.installmentMonths ?? null,
          p_installment_amount_type: input.installmentAmountType ?? null,
          p_apply_changes_to_future: input.applyChangesToFuture ?? true,
        },
      )
      if (options.signal) updateRequest.abortSignal(options.signal)
      const { error } = await updateRequest
      throwIfError(error)
      const transactionId = input.id
      if (input.tags !== undefined) {
        const tagRequest = client
          .from("transactions")
          .update({ tags: input.tags })
          .eq("id", transactionId)
        if (options.signal) tagRequest.abortSignal(options.signal)
        const { error: tagError } = await tagRequest
        throwIfError(tagError)
      }
      if (input.splits !== undefined) {
        await this.replaceTransactionSplits(
          transactionId,
          input.splits,
          options,
        )
      }
      return transactionId
    }

    if (input.recurringType === "installment") {
      const installmentRequest = client.rpc("save_card_installment_series_v4", {
        p_rule_id: input.recurringRuleId ?? null,
        p_request_id: input.requestId ?? null,
        p_ledger_id: input.ledgerId,
        p_amount: input.amount,
        p_amount_type: input.installmentAmountType ?? "monthly",
        p_transaction_at: input.transactionAt,
        p_installment_months: input.installmentMonths ?? 2,
        p_category_id: input.categoryId ?? null,
        p_merchant_name: input.merchantName ?? null,
        p_memo: input.memo ?? null,
        p_actor_user_id: input.actorUserId ?? null,
        p_status: input.status,
        p_type: input.type,
        p_payment_method_id: input.paymentMethodId,
      })
      if (options.signal) installmentRequest.abortSignal(options.signal)
      const { data, error } = await installmentRequest
      throwIfError(error)
      return typeof data === "string" ? data : undefined
    }

    if (!input.id && input.recurringType === "fixed") {
      const date = new Date(input.transactionAt)
      const startMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
      const ruleRequest = client.from("recurring_rules").insert({
        ...(input.requestId ? { id: input.requestId } : {}),
        ledger_id: input.ledgerId,
        created_by: userId,
        rule_type: input.recurringType,
        amount: input.amount,
        day_of_month: date.getDate(),
        time_of_day: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
        start_month: startMonth,
        end_month: null,
        installment_months: null,
        category_id: input.categoryId ?? null,
        payment_method_id: input.paymentMethodId ?? null,
        merchant_name: input.merchantName ?? null,
        memo: input.memo ?? null,
        transaction_type: input.type,
        income_kind: input.incomeKind ?? null,
        transaction_status: input.status,
        actor_user_id: input.actorUserId ?? null,
      })
      if (options.signal) ruleRequest.abortSignal(options.signal)
      const { error: ruleError } = await ruleRequest
      if (
        ruleError &&
        input.requestId &&
        isDuplicatePrimaryKeyError(ruleError)
      ) {
        const existing = await this.findTransactionRequest(input.requestId)
        if (existing.recurringRuleId !== input.requestId) {
          throwIfError(ruleError)
        }
      } else {
        throwIfError(ruleError)
      }
      await this.materializeMonth(startMonth.slice(0, 7))
      return undefined
    }

    const saveRequest = client
      .from("transactions")
      .insert({
        ...payload,
        ...(input.requestId ? { id: input.requestId } : {}),
        income_kind: input.incomeKind ?? null,
        created_by: userId,
      })
      .select("id")
    if (options.signal) saveRequest.abortSignal(options.signal)
    const result = await saveRequest.single()
    let transactionId: string | undefined
    if (
      result.error &&
      input.requestId &&
      isDuplicatePrimaryKeyError(result.error)
    ) {
      const existing = await this.findTransactionRequest(input.requestId)
      if (existing.transactionId !== input.requestId) {
        throwIfError(result.error)
      }
      transactionId = existing.transactionId
    } else {
      throwIfError(result.error)
      transactionId =
        result.data && typeof result.data.id === "string"
          ? result.data.id
          : undefined
    }
    if (transactionId && input.splits !== undefined) {
      await this.replaceTransactionSplits(transactionId, input.splits, options)
    }
    return transactionId
  }

  private async replaceTransactionSplits(
    transactionId: string,
    splits: Array<{ categoryId: string; amount: number }>,
    options: FinanceMutationOptions = {},
  ): Promise<void> {
    const client = this.requireClient()
    const replaceRequest = client.rpc("replace_transaction_splits", {
      p_transaction_id: transactionId,
      p_splits: splits.map((split) => ({
        categoryId: split.categoryId,
        amount: split.amount,
      })),
    })
    if (options.signal) replaceRequest.abortSignal(options.signal)
    const { error } = await replaceRequest
    throwIfError(error)
  }

  async importTransactions(
    userId: string,
    ledgerId: string,
    transactions: Array<
      Pick<
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
    >,
  ): Promise<void> {
    const client = this.requireClient()
    const rows = transactions.map((transaction) => ({
      ledger_id: ledgerId,
      created_by: userId,
      updated_by: userId,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      transaction_at: transaction.transactionAt,
      category_id: transaction.categoryId ?? null,
      payment_method_id: transaction.paymentMethodId ?? null,
      merchant_name: transaction.merchantName ?? null,
      memo: transaction.memo ?? null,
      actor_user_id: transaction.actorUserId ?? null,
      source_type: "import",
      tags: transaction.tags ?? [],
    }))
    for (let index = 0; index < rows.length; index += 200) {
      const { error } = await client
        .from("transactions")
        .insert(rows.slice(index, index + 200))
      throwIfError(error)
    }
  }

  async materializeMonth(month: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("materialize_finance_month", {
      target_month: `${month}-01`,
    })
    throwIfError(error)
  }

  async setCategoryBudget(input: {
    ledgerId: string
    categoryId: string
    month: string
    amount: number
    userId: string
  }): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("set_secure_category_budget", {
      p_ledger_id: input.ledgerId,
      p_category_id: input.categoryId,
      p_effective_month: `${input.month}-01`,
      p_amount: input.amount,
    })
    throwIfError(error)
  }

  async saveMonthNote(
    ledgerId: string,
    month: string,
    note: string,
    existingId?: string,
  ): Promise<void> {
    const client = this.requireClient()
    if (existingId) {
      const { error } = await client
        .from("ledger_month_notes")
        .update({ note })
        .eq("id", existingId)
      throwIfError(error)
      return
    }
    const { error } = await client.from("ledger_month_notes").insert({
      ledger_id: ledgerId,
      month: `${month}-01`,
      note,
    })
    throwIfError(error)
  }

  async createCard(input: {
    name: string
    issuer: string
    last4?: string
    paymentDay: number
    billingPeriodEndDay: number
    billingPeriodEndMonthOffset: -1 | 0
    isDebit: boolean
  }): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("create_user_payment_instrument", {
      p_type: "card",
      p_name: input.name,
      p_last4: input.last4 ?? null,
      p_issuer: input.issuer,
      p_payment_day: input.paymentDay,
      p_billing_period_end_day: input.billingPeriodEndDay,
      p_billing_period_end_month_offset: input.billingPeriodEndMonthOffset,
      p_is_debit: input.isDebit,
    })
    throwIfError(error)
  }

  async createAccount(input: {
    name: string
    bank: string
    last4?: string
  }): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("create_user_payment_instrument", {
      p_type: "bank",
      p_name: input.name,
      p_last4: input.last4 ?? null,
      p_issuer: input.bank,
      p_payment_day: null,
      p_billing_period_end_day: null,
      p_billing_period_end_month_offset: null,
      p_is_debit: false,
    })
    throwIfError(error)
  }

  async updateAccount(
    accountId: string,
    input: {
      name: string
      bank: string
      last4?: string
    },
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("update_user_payment_instrument", {
      p_id: accountId,
      p_type: "bank",
      p_name: input.name,
      p_last4: input.last4 ?? null,
      p_issuer: input.bank,
      p_payment_day: null,
      p_billing_period_end_day: null,
      p_billing_period_end_month_offset: null,
      p_is_debit: false,
    })
    throwIfError(error)
  }

  async setAccountActive(accountId: string, isActive: boolean): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("set_user_payment_instrument_active", {
      p_id: accountId,
      p_is_active: isActive,
    })
    throwIfError(error)
  }

  async deleteAccount(accountId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("delete_user_payment_instrument", {
      p_id: accountId,
    })
    throwIfError(error)
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
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("update_user_payment_instrument", {
      p_id: cardId,
      p_type: "card",
      p_name: input.name,
      p_last4: input.last4 ?? null,
      p_issuer: input.issuer,
      p_payment_day: input.paymentDay,
      p_billing_period_end_day: input.billingPeriodEndDay,
      p_billing_period_end_month_offset: input.billingPeriodEndMonthOffset,
      p_is_debit: input.isDebit,
    })
    throwIfError(error)
  }

  async setCardActive(cardId: string, isActive: boolean): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("set_user_payment_instrument_active", {
      p_id: cardId,
      p_is_active: isActive,
    })
    throwIfError(error)
  }

  async deleteCard(cardId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("delete_user_payment_instrument", {
      p_id: cardId,
    })
    throwIfError(error)
  }

  async deactivateFixedRule(ruleId: string, month: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("deactivate_fixed_rule_from_month", {
      p_rule_id: ruleId,
      p_month: `${month}-01`,
    })
    throwIfError(error)
  }

  async deleteInstallmentOccurrences(
    ruleId: string,
    installmentNumber: number,
    scope: InstallmentDeleteScope,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("delete_installment_occurrences", {
      p_rule_id: ruleId,
      p_installment_number: installmentNumber,
      p_scope: scope,
    })
    throwIfError(error)
  }

  async softDeleteTransaction(
    transactionId: string,
    userId: string,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client
      .from("transactions")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
    throwIfError(error)
  }

  async createCategory(input: {
    ledgerId: string
    name: string
    icon: string
    color: string
    usageTypes: CategoryUsageType[]
    parentCategoryId?: string
  }): Promise<string> {
    const client = this.requireClient()
    const { data, error } = await client.rpc("create_category_v2", {
      p_ledger_id: input.ledgerId,
      p_name: input.name,
      p_icon: input.icon,
      p_color: input.color,
      p_usage_types: input.usageTypes,
      p_parent_category_id: input.parentCategoryId ?? null,
    })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("생성한 카테고리를 확인할 수 없습니다.")
    }
    return data
  }

  async updateCategory(
    categoryId: string,
    category: Pick<
      Category,
      "name" | "icon" | "color" | "usageTypes" | "parentCategoryId"
    >,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("update_category_v2", {
      p_category_id: categoryId,
      p_name: category.name,
      p_icon: category.icon,
      p_color: category.color,
      p_usage_types: category.usageTypes,
      p_parent_category_id: category.parentCategoryId ?? null,
    })
    throwIfError(error)
  }

  async archiveCategory(categoryId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("archive_category_v2", {
      p_category_id: categoryId,
    })
    throwIfError(error)
  }

  async updateCategoryOrder(
    parentCategoryId: string | undefined,
    categoryIds: string[],
  ): Promise<void> {
    if (categoryIds.length === 0) return

    const client = this.requireClient()
    const { error } = await client.rpc("reorder_category_siblings", {
      p_parent_category_id: parentCategoryId ?? null,
      p_category_ids: categoryIds,
    })
    throwIfError(error)
  }

  async createLedger(input: {
    name: string
    type: LedgerType
    setDefault: boolean
    paymentInstrumentIds: string[]
    ledgerVisibleInstrumentIds: string[]
  }): Promise<string> {
    const client = this.requireClient()
    const { data, error } = await client.rpc("create_ledger", {
      p_name: input.name,
      p_type: input.type,
      p_set_default: input.setDefault,
      p_payment_instrument_ids: input.paymentInstrumentIds,
      p_ledger_visible_instrument_ids: input.ledgerVisibleInstrumentIds,
    })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("가계부 생성 결과를 확인할 수 없습니다.")
    }

    return data
  }

  async renameLedger(ledgerId: string, name: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("rename_ledger", {
      p_ledger_id: ledgerId,
      p_name: name,
    })
    throwIfError(error)
  }

  async setDefaultLedger(ledgerId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("set_default_ledger", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async archiveLedger(ledgerId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("archive_ledger", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async restoreLedger(ledgerId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("restore_ledger", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async leaveSharedLedger(ledgerId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("leave_shared_ledger", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async convertPersonalLedgerToShared(ledgerId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("convert_personal_ledger_to_shared", {
      p_ledger_id: ledgerId,
      p_shared_payment_method_ids: [],
    })
    throwIfError(error)
  }

  async createInvite(
    ledgerId: string,
    roleToGrant: Exclude<LedgerRole, "owner">,
  ): Promise<CreatedLedgerInvitation> {
    const client = this.requireClient()
    const { data, error } = await client.rpc("create_ledger_invite", {
      p_ledger_id: ledgerId,
      p_role_to_grant: roleToGrant,
    })
    throwIfError(error)
    if (!data || typeof data !== "object") {
      throw new Error("초대 코드 생성 결과를 확인할 수 없습니다.")
    }
    const result = data as Record<string, unknown>
    if (
      typeof result.id !== "string" ||
      typeof result.inviteCode !== "string" ||
      typeof result.expiresAt !== "string"
    ) {
      throw new Error("초대 코드 생성 결과가 올바르지 않습니다.")
    }
    return {
      id: result.id,
      inviteCode: result.inviteCode,
      expiresAt: result.expiresAt,
    }
  }

  async updateLedgerMemberRole(
    ledgerId: string,
    targetUserId: string,
    role: Exclude<LedgerRole, "owner">,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("update_ledger_member_role", {
      p_ledger_id: ledgerId,
      p_target_user_id: targetUserId,
      p_role: role,
    })
    throwIfError(error)
  }

  async removeLedgerMember(
    ledgerId: string,
    targetUserId: string,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("remove_ledger_member", {
      p_ledger_id: ledgerId,
      p_target_user_id: targetUserId,
    })
    throwIfError(error)
  }

  async transferLedgerOwnership(
    ledgerId: string,
    targetUserId: string,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("transfer_ledger_ownership", {
      p_ledger_id: ledgerId,
      p_target_user_id: targetUserId,
    })
    throwIfError(error)
  }

  async acceptInvite(inviteCode: string): Promise<AcceptLedgerInviteResult> {
    const client = this.requireClient()
    const { data, error } = await client.rpc(
      "accept_ledger_invite_and_set_default",
      {
        submitted_code: inviteCode,
      },
    )
    throwIfError(error)
    if (!data || typeof data !== "object" || !("status" in data)) {
      throw new Error("초대 코드 확인 결과를 읽을 수 없습니다.")
    }
    const result = data as Record<string, unknown>
    if (result.status === "invalid_or_expired") {
      return { status: "invalid_or_expired" }
    }
    if (
      (result.status === "accepted" || result.status === "already_member") &&
      typeof result.ledgerId === "string"
    ) {
      return { status: result.status, ledgerId: result.ledgerId }
    }
    throw new Error("초대 코드 확인 결과를 읽을 수 없습니다.")
  }

  async syncMyLedgerPaymentMethods(
    ledgerId: string,
    paymentInstrumentIds: string[],
    ledgerVisibleInstrumentIds: string[],
    primaryInstrumentId?: string,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("sync_my_ledger_payment_methods", {
      p_ledger_id: ledgerId,
      p_payment_instrument_ids: paymentInstrumentIds,
      p_ledger_visible_instrument_ids: ledgerVisibleInstrumentIds,
      p_primary_instrument_id: primaryInstrumentId ?? null,
    })
    throwIfError(error)
  }

  async revokeInvite(invitationId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client
      .from("ledger_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
    throwIfError(error)
  }

  async submitCardMessageSample(
    userId: string,
    input: RemoteSampleInput,
  ): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.from("card_message_samples").insert({
      submitted_by: userId,
      card_company_name: input.cardCompanyName ?? null,
      masked_message: input.maskedMessage,
      expected_amount: input.expectedAmount ?? null,
      expected_merchant_name: input.expectedMerchantName ?? null,
      expected_transaction_at: input.expectedTransactionAt ?? null,
      parse_result: input.parseResult ?? null,
      consent_version: "2026-06-28",
    })
    throwIfError(error)
  }

  async requestAccountDeletion(): Promise<string> {
    const client = this.requireClient()
    const { data, error } = await client.rpc("request_account_deletion")
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("계정 삭제 일정을 확인하지 못했습니다.")
    }
    return data
  }

  async acceptLegalTerms(
    termsVersion: string,
    privacyVersion: string,
  ): Promise<string> {
    const client = this.requireClient()
    const { data, error } = await client.rpc("accept_current_legal_terms", {
      p_terms_version: termsVersion,
      p_privacy_version: privacyVersion,
    })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("약관 동의 기록을 확인하지 못했습니다.")
    }
    return data
  }

  async cancelAccountDeletion(): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.rpc("cancel_account_deletion")
    throwIfError(error)
  }
}

function requireSupabaseClient() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  }

  return client
}

const DATABASE_PAGE_SIZE = 500

async function fetchAllTransactionRows(
  client: SalimonSupabaseClient,
  dateRange?: TransactionDateRange,
): Promise<{ data: Row[] | null; error: unknown }> {
  const rows: Row[] = []
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    let query = client
      .from("transactions")
      .select(
        "id, ledger_id, created_by, updated_by, actor_user_id, type, status, amount, currency, transaction_at, category_id, payment_method_id, merchant_name, memo, source_type, source_app, source_sender, source_hash, parse_confidence, recurring_rule_id, recurring_type, installment_number, installment_total, created_at, updated_at, deleted_at, tags",
      )
      .is("deleted_at", null)

    if (dateRange) {
      query = query
        .gte("transaction_at", dateRange.start)
        .lt("transaction_at", dateRange.endExclusive)
    }

    const { data, error } = await query
      .order("transaction_at", { ascending: false })
      .order("id")
      .range(from, from + DATABASE_PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...((data ?? []) as Row[]))
    if ((data?.length ?? 0) < DATABASE_PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

async function fetchAllTransactionSplitRows(
  client: SalimonSupabaseClient,
  transactionIds?: string[],
): Promise<{ data: Row[] | null; error: unknown }> {
  if (transactionIds?.length === 0) {
    return { data: [], error: null }
  }

  const rows: Row[] = []
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    let query = client
      .from("transaction_splits")
      .select("id, transaction_id, category_id, amount, sort_order")

    if (transactionIds) {
      query = query.in("transaction_id", transactionIds)
    }

    const { data, error } = await query
      .order("transaction_id")
      .order("sort_order")
      .range(from, from + DATABASE_PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...((data ?? []) as Row[]))
    if ((data?.length ?? 0) < DATABASE_PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

function validateTransactionDateRange(
  dateRange: TransactionDateRange | undefined,
): void {
  if (!dateRange) return

  const start = Date.parse(dateRange.start)
  const endExclusive = Date.parse(dateRange.endExclusive)
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(endExclusive) ||
    start >= endExclusive
  ) {
    throw new Error("거래 조회 기간이 올바르지 않습니다.")
  }
}

interface RepositoryErrorLike {
  code?: string
  details?: string
  message: string
}

function throwIfError(error: RepositoryErrorLike | null): void {
  if (error) {
    if (isDuplicateTransactionSourceError(error)) {
      throw new DuplicateTransactionSourceError()
    }
    throw new Error(error.message)
  }
}

function isDuplicateTransactionSourceError(
  error: RepositoryErrorLike,
): boolean {
  if (error.code !== "23505") return false
  return /transactions_(?:ledger|creator)_source_hash_uidx|(?:ledger_id|created_by), source_hash/i.test(
    `${error.message} ${error.details ?? ""}`,
  )
}

function isDuplicatePrimaryKeyError(error: RepositoryErrorLike): boolean {
  return (
    error.code === "23505" &&
    /(?:encrypted_)?(?:transactions|recurring_rules)_pkey|Key \(id\)=/i.test(
      `${error.message} ${error.details ?? ""}`,
    )
  )
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(error.message)
  }
  return new Error(fallbackMessage)
}

function mapProfile(row: Row): Profile {
  return {
    id: stringValue(row.id),
    kakaoId: optionalString(row.kakao_id),
    nickname: optionalString(row.nickname) ?? "Salimon 사용자",
    avatarUrl: optionalString(row.avatar_url),
    defaultCurrency: "KRW",
    timezone: optionalString(row.timezone) ?? "Asia/Seoul",
  }
}

function mapLedger(row: Row, members: LedgerMember[], userId: string): Ledger {
  const id = stringValue(row.id)
  const ownMembership = members.find(
    (member) => member.ledgerId === id && member.userId === userId,
  )
  return {
    id,
    ownerId: stringValue(row.owner_id),
    name: optionalString(row.name) ?? "가계부",
    type: row.type === "shared" ? "shared" : "personal",
    currency: "KRW",
    role: ownMembership?.role ?? "member",
    archivedAt: optionalString(row.archived_at),
    purgeAfter: optionalString(row.purge_after),
  }
}

function mapMember(row: Row, profile: Profile, userId: string): LedgerMember {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    userId: stringValue(row.user_id),
    nickname:
      optionalString(row.nickname) ??
      (stringValue(row.user_id) === userId ? profile.nickname : "공동 멤버"),
    role: mapRole(row.role),
    status: row.status === "removed" ? "removed" : "active",
    isDefault: Boolean(row.is_default),
    joinedAt: stringValue(row.joined_at),
  }
}

function mapInvitation(row: Row): LedgerInvitation {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    invitedBy: stringValue(row.invited_by),
    inviteCode: optionalString(row.invite_code),
    roleToGrant: mapInvitationRole(row.role_to_grant),
    status: mapInvitationStatus(row.status),
    expiresAt: stringValue(row.expires_at),
    createdAt: stringValue(row.created_at),
  }
}

function mapMemberEvent(row: Row): LedgerMemberEvent {
  const action = stringValue(row.action)
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    actorUserId: optionalString(row.actor_user_id),
    targetUserId: optionalString(row.target_user_id),
    action:
      action === "removed" || action === "ownership_transferred"
        ? action
        : "role_changed",
    previousRole: optionalLedgerRole(row.previous_role),
    nextRole: optionalLedgerRole(row.next_role),
    createdAt: stringValue(row.created_at),
  }
}

function mapCategory(row: Row, usageTypes?: CategoryUsageType[]): Category {
  const type = mapTransactionType(row.type)
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: optionalString(row.created_by),
    type,
    usageTypes:
      usageTypes && usageTypes.length > 0
        ? usageTypes
        : [type === "income" || type === "saving" ? type : "expense"],
    name: optionalString(row.name) ?? "카테고리",
    icon: optionalString(row.icon) ?? "circle",
    color: optionalString(row.color) ?? "#6c757d",
    sortOrder: numberValue(row.sort_order),
    isDefault: Boolean(row.is_default),
    isArchived: Boolean(row.is_archived),
    parentCategoryId: optionalString(row.parent_category_id),
  }
}

function mapCategoryUsageType(value: unknown): CategoryUsageType | undefined {
  return value === "expense" || value === "income" || value === "saving"
    ? value
    : undefined
}

function mapCategoryBudget(row: Row): CategoryBudget {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    categoryId: stringValue(row.category_id),
    effectiveMonth: stringValue(row.effective_month).slice(0, 7),
    amount: numberValue(row.amount),
    createdAt: stringValue(row.created_at),
  }
}

function mapMonthNote(row: Row): LedgerMonthNote {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    month: stringValue(row.month).slice(0, 7),
    note: optionalString(row.note) ?? "",
    updatedBy: optionalString(row.updated_by),
    updatedAt: stringValue(row.updated_at),
  }
}

function mapLegalConsent(row: Row): LegalConsent {
  return {
    userId: stringValue(row.user_id),
    termsVersion: stringValue(row.terms_version),
    privacyVersion: stringValue(row.privacy_version),
    acceptedAt: stringValue(row.accepted_at),
  }
}

function mapRecurringRule(row: Row): RecurringRule {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: optionalString(row.created_by),
    type: row.rule_type === "installment" ? "installment" : "fixed",
    transactionType: mapTransactionType(row.transaction_type),
    incomeKind: mapIncomeKind(row.income_kind),
    amount: numberValue(row.amount),
    dayOfMonth: numberValue(row.day_of_month),
    timeOfDay: stringValue(row.time_of_day),
    startMonth: stringValue(row.start_month).slice(0, 7),
    endMonth: optionalString(row.end_month)?.slice(0, 7),
    inactiveFromMonth: optionalString(row.inactive_from_month)?.slice(0, 7),
    installmentMonths:
      row.installment_months == null
        ? undefined
        : numberValue(row.installment_months),
    installmentAmountType:
      row.installment_amount_type === "principal" ? "principal" : "monthly",
    installmentPrincipal:
      row.installment_principal == null
        ? undefined
        : numberValue(row.installment_principal),
    purchaseAt: optionalString(row.purchase_at),
    paymentMethodId: optionalString(row.payment_method_id),
    categoryId: optionalString(row.category_id),
    merchantName: optionalString(row.merchant_name),
    memo: optionalString(row.memo),
    isActive: Boolean(row.is_active),
    createdAt: stringValue(row.created_at),
  }
}

function mapPaymentMethod(row: Row): PaymentMethod {
  const offset = numberValue(row.billing_period_end_month_offset)
  return {
    id: stringValue(row.id),
    instrumentId: stringValue(row.payment_instrument_id) || stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    ownerUserId: optionalString(row.owner_user_id),
    name: stringValue(row.name),
    type: mapPaymentMethodType(row.type),
    last4: optionalString(row.last4),
    issuer: optionalString(row.issuer),
    visibility: row.visibility === "private" ? "private" : "ledger",
    isActive: Boolean(row.is_active),
    isDeleted: Boolean(row.deleted_at),
    isPrimary: Boolean(row.is_primary),
    isDebit: Boolean(row.is_debit),
    paymentDay:
      row.payment_day == null ? undefined : numberValue(row.payment_day),
    billingPeriodEndDay:
      row.billing_period_end_day == null
        ? undefined
        : numberValue(row.billing_period_end_day),
    billingPeriodEndMonthOffset: offset === 0 ? 0 : -1,
  }
}

export function mapPaymentMethodType(value: unknown): PaymentMethod["type"] {
  return value === "bank" ? "bank" : "card"
}

function mapPaymentInstrument(row: Row): PaymentInstrument {
  const offset = numberValue(row.billing_period_end_month_offset)
  return {
    id: stringValue(row.id),
    ownerUserId: stringValue(row.owner_user_id),
    name: stringValue(row.name),
    type: mapPaymentMethodType(row.type),
    last4: optionalString(row.last4),
    issuer: optionalString(row.issuer),
    isActive: Boolean(row.is_active),
    isDeleted: Boolean(row.deleted_at),
    isDebit: Boolean(row.is_debit),
    paymentDay:
      row.payment_day == null ? undefined : numberValue(row.payment_day),
    billingPeriodEndDay:
      row.billing_period_end_day == null
        ? undefined
        : numberValue(row.billing_period_end_day),
    billingPeriodEndMonthOffset: offset === 0 ? 0 : -1,
  }
}

function mapTransaction(row: Row): Transaction {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: optionalString(row.created_by),
    updatedBy: optionalString(row.updated_by),
    actorUserId: optionalString(row.actor_user_id),
    type: mapTransactionType(row.type),
    incomeKind: mapIncomeKind(row.income_kind),
    status: mapTransactionStatus(row.status),
    amount: numberValue(row.amount),
    currency: "KRW",
    transactionAt: stringValue(row.transaction_at),
    categoryId: optionalString(row.category_id),
    paymentMethodId: optionalString(row.payment_method_id),
    merchantName: optionalString(row.merchant_name),
    memo: optionalString(row.memo),
    sourceType: mapSourceType(row.source_type),
    sourceApp: optionalString(row.source_app),
    sourceSender: optionalString(row.source_sender),
    sourceHash: optionalString(row.source_hash),
    parseConfidence:
      row.parse_confidence === null
        ? undefined
        : numberValue(row.parse_confidence),
    recurringRuleId: optionalString(row.recurring_rule_id),
    recurringType:
      row.recurring_type === "fixed" || row.recurring_type === "installment"
        ? row.recurring_type
        : undefined,
    installmentNumber:
      row.installment_number == null
        ? undefined
        : numberValue(row.installment_number),
    installmentTotal:
      row.installment_total == null
        ? undefined
        : numberValue(row.installment_total),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    deletedAt: optionalString(row.deleted_at),
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  }
}

function mapTransactionSplit(row: Row): TransactionSplit {
  return {
    id: stringValue(row.id),
    transactionId: stringValue(row.transaction_id),
    categoryId: stringValue(row.category_id),
    amount: numberValue(row.amount),
    sortOrder: numberValue(row.sort_order),
  }
}

function mapSample(row: Row): CardMessageSample {
  return {
    id: stringValue(row.id),
    submittedBy: stringValue(row.submitted_by),
    cardCompanyName: optionalString(row.card_company_name),
    maskedMessage: stringValue(row.masked_message),
    expectedAmount:
      row.expected_amount === null
        ? undefined
        : numberValue(row.expected_amount),
    expectedMerchantName: optionalString(row.expected_merchant_name),
    expectedTransactionAt: optionalString(row.expected_transaction_at),
    parseResult:
      (row.parse_result as CardMessageSample["parseResult"]) ?? undefined,
    consentVersion: stringValue(row.consent_version),
    status: mapSampleStatus(row.status),
    createdAt: stringValue(row.created_at),
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function mapRole(value: unknown): Ledger["role"] {
  return value === "owner" || value === "admin" || value === "viewer"
    ? value
    : "member"
}

function optionalLedgerRole(value: unknown): LedgerRole | undefined {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : undefined
}

function mapTransactionType(value: unknown): TransactionType {
  return value === "income" || value === "saving" ? value : "expense"
}

function mapIncomeKind(value: unknown): IncomeKind | undefined {
  return value === "salary" || value === "side_income" ? value : undefined
}

function mapTransactionStatus(value: unknown): TransactionStatus {
  return value === "excluded" ? value : "confirmed"
}

function mapSourceType(value: unknown): TransactionSourceType {
  return value === "android_sms_notification" ||
    value === "paste" ||
    value === "import" ||
    value === "receipt_ai"
    ? value
    : "manual"
}

function mapInvitationStatus(value: unknown): LedgerInvitation["status"] {
  return value === "accepted" || value === "expired" || value === "revoked"
    ? value
    : "active"
}

function mapInvitationRole(value: unknown): LedgerInvitation["roleToGrant"] {
  return value === "admin" || value === "viewer" ? value : "member"
}

function mapSampleStatus(value: unknown): CardMessageSample["status"] {
  return value === "reviewing" || value === "applied" || value === "rejected"
    ? value
    : "submitted"
}
