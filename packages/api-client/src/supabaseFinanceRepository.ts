import type {
  CardMessageSample,
  Category,
  CategoryBudget,
  CategoryUsageType,
  Ledger,
  LedgerInvitation,
  LedgerMember,
  LedgerType,
  PaymentMethod,
  Profile,
  RecurringRule,
  Transaction,
  TransactionSourceType,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"
import type { FinanceData } from "./financeData"
import { getSupabaseBrowserClient } from "./supabaseClient"

type Row = Record<string, unknown>

export interface RemoteTransactionInput {
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
  sourceType?: TransactionSourceType
  sourceHash?: string
  parseConfidence?: number
  recurringType?: "fixed" | "installment"
  recurringRuleId?: string
  installmentMonths?: number
  installmentAmountType?: "monthly" | "principal"
  paymentMethodId?: string
}

export interface RemoteSampleInput {
  cardCompanyName?: string
  maskedMessage: string
  expectedAmount?: number
  expectedMerchantName?: string
  expectedTransactionAt?: string
  parseResult?: object
}

export class SupabaseFinanceRepository {
  async load(userId: string): Promise<FinanceData> {
    const client = requireSupabaseClient()
    const [
      profileResult,
      ledgersResult,
      membersResult,
      categoriesResult,
      categoryUsagesResult,
      budgetsResult,
      rulesResult,
      paymentMethodsResult,
      transactionsResult,
      invitationsResult,
      samplesResult,
    ] = await Promise.all([
      client
        .from("profiles")
        .select(
          "id, kakao_id, nickname, avatar_url, default_currency, timezone",
        )
        .single(),
      client
        .from("ledgers")
        .select("id, owner_id, name, type, currency")
        .order("created_at"),
      client
        .from("ledger_members")
        .select(
          "id, ledger_id, user_id, nickname, role, status, is_default, joined_at",
        )
        .eq("status", "active")
        .order("joined_at"),
      client
        .from("categories")
        .select(
          "id, ledger_id, created_by, type, name, icon, color, sort_order, is_default, is_archived",
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
          "id, ledger_id, created_by, rule_type, amount, day_of_month, time_of_day, start_month, end_month, inactive_from_month, installment_months, installment_amount_type, installment_principal, purchase_at, payment_method_id, category_id, merchant_name, memo, is_active, created_at",
        )
        .order("created_at"),
      client
        .from("payment_methods")
        .select(
          "id, ledger_id, owner_user_id, name, type, last4, issuer, visibility, is_active, is_primary, is_debit, deleted_at, payment_day, billing_period_end_day, billing_period_end_month_offset",
        )
        .in("type", ["card", "bank"])
        .order("created_at"),
      client
        .from("transactions")
        .select(
          "id, ledger_id, created_by, updated_by, actor_user_id, type, status, amount, currency, transaction_at, category_id, payment_method_id, merchant_name, memo, source_type, source_app, source_sender, source_hash, parse_confidence, recurring_rule_id, recurring_type, installment_number, installment_total, created_at, updated_at, deleted_at",
        )
        .is("deleted_at", null)
        .order("transaction_at", { ascending: false }),
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
    ])

    const results = [
      profileResult,
      ledgersResult,
      membersResult,
      categoriesResult,
      categoryUsagesResult,
      budgetsResult,
      rulesResult,
      paymentMethodsResult,
      transactionsResult,
      invitationsResult,
      samplesResult,
    ]
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      throw failed.error
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
      invitations: ((invitationsResult.data ?? []) as Row[]).map(mapInvitation),
      categories: ((categoriesResult.data ?? []) as Row[]).map((row) =>
        mapCategory(row, categoryUsages.get(stringValue(row.id))),
      ),
      categoryBudgets: ((budgetsResult.data ?? []) as Row[]).map(
        mapCategoryBudget,
      ),
      recurringRules: ((rulesResult.data ?? []) as Row[]).map(mapRecurringRule),
      paymentMethods: ((paymentMethodsResult.data ?? []) as Row[]).map(
        mapPaymentMethod,
      ),
      transactions: ((transactionsResult.data ?? []) as Row[]).map(
        mapTransaction,
      ),
      smsCandidates: [],
      cardMessageSamples: ((samplesResult.data ?? []) as Row[]).map(mapSample),
    }
  }

  async saveTransaction(
    userId: string,
    input: RemoteTransactionInput,
  ): Promise<string | undefined> {
    const client = requireSupabaseClient()
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
      source_hash: input.sourceHash ?? null,
      parse_confidence: input.parseConfidence ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { data, error } = await client.rpc(
        "update_transaction_with_recurrence",
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
          p_payment_method_id: input.paymentMethodId ?? null,
          p_recurring_type: input.recurringType ?? null,
          p_installment_months: input.installmentMonths ?? null,
          p_installment_amount_type: input.installmentAmountType ?? null,
        },
      )
      throwIfError(error)
      return typeof data === "string" ? data : undefined
    }

    if (input.recurringType === "installment") {
      const { data, error } = await client.rpc(
        "save_card_installment_series_v2",
        {
          p_rule_id: input.recurringRuleId ?? null,
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
        },
      )
      throwIfError(error)
      return typeof data === "string" ? data : undefined
    }

    if (!input.id && input.recurringType === "fixed") {
      const date = new Date(input.transactionAt)
      const startMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
      const { error: ruleError } = await client.from("recurring_rules").insert({
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
        transaction_status: input.status,
        actor_user_id: input.actorUserId ?? null,
      })
      throwIfError(ruleError)
      await this.materializeMonth(startMonth.slice(0, 7))
      return undefined
    }

    const result = await client
      .from("transactions")
      .insert({ ...payload, created_by: userId })
    throwIfError(result.error)
    return undefined
  }

  async materializeMonth(month: string): Promise<void> {
    const client = requireSupabaseClient()
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
    const client = requireSupabaseClient()
    const { error } = await client.from("category_budgets").upsert(
      {
        ledger_id: input.ledgerId,
        category_id: input.categoryId,
        effective_month: `${input.month}-01`,
        amount: input.amount,
        created_by: input.userId,
      },
      { onConflict: "category_id,effective_month" },
    )
    throwIfError(error)
  }

  async createCard(input: {
    ledgerId: string
    ownerUserId: string
    name: string
    issuer: string
    last4?: string
    paymentDay: number
    billingPeriodEndDay: number
    billingPeriodEndMonthOffset: -1 | 0
    isPrimary: boolean
    isDebit: boolean
  }): Promise<void> {
    const client = requireSupabaseClient()
    const { data, error } = await client
      .from("payment_methods")
      .insert({
        ledger_id: input.ledgerId,
        owner_user_id: input.ownerUserId,
        name: input.name,
        type: "card",
        last4: input.last4 || null,
        issuer: input.issuer,
        visibility: "ledger",
        payment_day: input.isDebit ? 31 : input.paymentDay,
        billing_period_end_day: input.isDebit ? 31 : input.billingPeriodEndDay,
        billing_period_end_month_offset: input.isDebit
          ? -1
          : input.billingPeriodEndMonthOffset,
        is_debit: input.isDebit,
        is_primary: false,
      })
      .select("id")
      .single()
    throwIfError(error)
    if (input.isPrimary && data?.id) await this.setCardPrimary(data.id)
  }

  async createAccount(input: {
    ledgerId: string
    ownerUserId: string
    name: string
    bank: string
    last4?: string
  }): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.from("payment_methods").insert({
      ledger_id: input.ledgerId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      type: "bank",
      last4: input.last4 || null,
      issuer: input.bank,
      visibility: "ledger",
      is_active: true,
      is_primary: false,
      is_debit: false,
    })
    throwIfError(error)
  }

  async updateAccount(
    accountId: string,
    input: {
      ownerUserId: string
      name: string
      bank: string
      last4?: string
    },
  ): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        owner_user_id: input.ownerUserId,
        name: input.name,
        issuer: input.bank,
        last4: input.last4 || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("type", "bank")
    throwIfError(error)
  }

  async setAccountActive(accountId: string, isActive: boolean): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("type", "bank")
    throwIfError(error)
  }

  async deleteAccount(accountId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        is_active: false,
        is_primary: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("type", "bank")
    throwIfError(error)
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
  ): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        owner_user_id: input.ownerUserId,
        name: input.name,
        issuer: input.issuer,
        last4: input.last4 || null,
        payment_day: input.isDebit ? 31 : input.paymentDay,
        billing_period_end_day: input.isDebit ? 31 : input.billingPeriodEndDay,
        billing_period_end_month_offset: input.isDebit
          ? -1
          : input.billingPeriodEndMonthOffset,
        is_debit: input.isDebit,
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
    throwIfError(error)
    if (input.isPrimary) await this.setCardPrimary(cardId)
  }

  async setCardActive(cardId: string, isActive: boolean): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        is_active: isActive,
        ...(!isActive ? { is_primary: false } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
    throwIfError(error)
  }

  async deleteCard(cardId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("payment_methods")
      .update({
        is_active: false,
        is_primary: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
    throwIfError(error)
  }

  async setCardPrimary(cardId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { data: card, error: readError } = await client
      .from("payment_methods")
      .select("ledger_id, owner_user_id")
      .eq("id", cardId)
      .single()
    throwIfError(readError)
    if (!card) throw new Error("카드를 찾을 수 없습니다.")

    const { error: clearError } = await client
      .from("payment_methods")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("ledger_id", card.ledger_id)
      .eq("owner_user_id", card.owner_user_id)
    throwIfError(clearError)

    const { error } = await client
      .from("payment_methods")
      .update({
        is_primary: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
    throwIfError(error)
  }

  async resetMyFinanceData(): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.rpc("reset_my_finance_data")
    throwIfError(error)
  }

  async deactivateFixedRule(ruleId: string, month: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error: ruleError } = await client
      .from("recurring_rules")
      .update({
        inactive_from_month: `${month}-01`,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ruleId)
    throwIfError(ruleError)
    const start = new Date(`${month}-01T00:00:00`)
    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      1,
    ).toISOString()
    const { error } = await client
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("recurring_rule_id", ruleId)
      .gte("transaction_at", start.toISOString())
      .lt("transaction_at", end)
    throwIfError(error)
  }

  async softDeleteTransaction(
    transactionId: string,
    userId: string,
  ): Promise<void> {
    const client = requireSupabaseClient()
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
    userId: string
    name: string
    icon: string
    color: string
    sortOrder: number
    usageTypes: CategoryUsageType[]
  }): Promise<string> {
    const client = requireSupabaseClient()
    const { data, error } = await client
      .from("categories")
      .insert({
        ledger_id: input.ledgerId,
        created_by: input.userId,
        type: input.usageTypes[0],
        name: input.name,
        icon: input.icon,
        color: input.color,
        sort_order: input.sortOrder,
        is_default: false,
      })
      .select("id")
      .single()
    throwIfError(error)
    if (!data || typeof data.id !== "string") {
      throw new Error("생성한 카테고리를 확인할 수 없습니다.")
    }
    await this.setCategoryUsageTypes(data.id, input.usageTypes)
    return data.id
  }

  async updateCategory(
    categoryId: string,
    patch: Partial<
      Pick<Category, "name" | "icon" | "color" | "isArchived" | "usageTypes">
    >,
  ): Promise<void> {
    const client = requireSupabaseClient()
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (patch.name !== undefined) payload.name = patch.name
    if (patch.icon !== undefined) payload.icon = patch.icon
    if (patch.color !== undefined) payload.color = patch.color
    if (patch.isArchived !== undefined) payload.is_archived = patch.isArchived

    const { error } = await client
      .from("categories")
      .update(payload)
      .eq("id", categoryId)
    throwIfError(error)
    if (patch.usageTypes !== undefined) {
      await this.setCategoryUsageTypes(categoryId, patch.usageTypes)
    }
  }

  private async setCategoryUsageTypes(
    categoryId: string,
    usageTypes: CategoryUsageType[],
  ): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.rpc("set_category_usage_types", {
      p_category_id: categoryId,
      p_usage_types: usageTypes,
    })
    throwIfError(error)
  }

  async updateCategoryOrder(categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return

    const client = requireSupabaseClient()
    const { error } = await client.rpc("reorder_categories", {
      p_category_ids: categoryIds,
    })
    throwIfError(error)
  }

  async createLedger(input: {
    name: string
    type: LedgerType
    setDefault: boolean
  }): Promise<string> {
    const client = requireSupabaseClient()
    const { data, error } = await client.rpc("create_ledger", {
      p_name: input.name,
      p_type: input.type,
      p_set_default: input.setDefault,
    })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("가계부 생성 결과를 확인할 수 없습니다.")
    }

    return data
  }

  async renameLedger(ledgerId: string, name: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.rpc("rename_ledger", {
      p_ledger_id: ledgerId,
      p_name: name,
    })
    throwIfError(error)
  }

  async setDefaultLedger(ledgerId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.rpc("set_default_ledger", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async convertPersonalLedgerToShared(ledgerId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.rpc("convert_personal_ledger_to_shared", {
      p_ledger_id: ledgerId,
    })
    throwIfError(error)
  }

  async createInvite(input: {
    ledgerId: string
    userId: string
    inviteCode: string
    inviteTokenHash: string
  }): Promise<void> {
    const client = requireSupabaseClient()
    const now = new Date()
    const { error } = await client.from("ledger_invitations").insert({
      ledger_id: input.ledgerId,
      invited_by: input.userId,
      invite_code: input.inviteCode,
      invite_token_hash: input.inviteTokenHash,
      role_to_grant: "member",
      status: "active",
      expires_at: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    throwIfError(error)
  }

  async acceptInvite(inviteCode: string): Promise<string> {
    const client = requireSupabaseClient()
    const { data, error } = await client.rpc("accept_ledger_invite", {
      submitted_code: inviteCode,
    })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("초대 수락 결과를 확인할 수 없습니다.")
    }

    return data
  }

  async revokeInvite(invitationId: string): Promise<void> {
    const client = requireSupabaseClient()
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
    const client = requireSupabaseClient()
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
}

function requireSupabaseClient() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.")
  }

  return client
}

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message)
  }
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
    inviteCode: stringValue(row.invite_code),
    roleToGrant: mapInvitationRole(row.role_to_grant),
    status: mapInvitationStatus(row.status),
    expiresAt: stringValue(row.expires_at),
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

function mapRecurringRule(row: Row): RecurringRule {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: stringValue(row.created_by),
    type: row.rule_type === "installment" ? "installment" : "fixed",
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

function mapTransaction(row: Row): Transaction {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: stringValue(row.created_by),
    updatedBy: optionalString(row.updated_by),
    actorUserId: optionalString(row.actor_user_id),
    type: mapTransactionType(row.type),
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

function mapTransactionType(value: unknown): TransactionType {
  return value === "income" || value === "saving" ? value : "expense"
}

function mapTransactionStatus(value: unknown): TransactionStatus {
  return value === "pending" || value === "excluded" ? value : "confirmed"
}

function mapSourceType(value: unknown): TransactionSourceType {
  return value === "android_sms_notification" ||
    value === "paste" ||
    value === "import"
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
