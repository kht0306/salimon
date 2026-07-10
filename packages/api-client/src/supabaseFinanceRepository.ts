import type {
  CardMessageSample,
  Category,
  Ledger,
  LedgerInvitation,
  LedgerMember,
  PaymentMethod,
  Profile,
  Transaction,
  TransactionSourceType,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"
import type { FinanceData } from "./localRepository"
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
  sourceType?: TransactionSourceType
  sourceHash?: string
  parseConfidence?: number
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
    const [profileResult, ledgersResult, membersResult, categoriesResult, transactionsResult, invitationsResult, samplesResult] =
      await Promise.all([
        client.from("profiles").select("id, kakao_id, nickname, avatar_url, default_currency, timezone").single(),
        client.from("ledgers").select("id, owner_id, name, type, currency").order("created_at"),
        client
          .from("ledger_members")
          .select("id, ledger_id, user_id, nickname, role, status, joined_at")
          .eq("status", "active")
          .order("joined_at"),
        client
          .from("categories")
          .select("id, ledger_id, created_by, type, name, icon, color, sort_order, is_default, is_archived")
          .order("sort_order"),
        client
          .from("transactions")
          .select(
            "id, ledger_id, created_by, updated_by, type, status, amount, currency, transaction_at, category_id, payment_method_id, merchant_name, memo, source_type, source_app, source_sender, source_hash, parse_confidence, created_at, updated_at, deleted_at",
          )
          .order("transaction_at", { ascending: false }),
        client
          .from("ledger_invitations")
          .select("id, ledger_id, invited_by, invite_code, role_to_grant, status, expires_at, created_at")
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
      transactionsResult,
      invitationsResult,
      samplesResult,
    ]
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      throw failed.error
    }

    const profile = mapProfile(profileResult.data as Row)
    const members = ((membersResult.data ?? []) as Row[]).map((row) => mapMember(row, profile, userId))

    return {
      profile,
      ledgers: ((ledgersResult.data ?? []) as Row[]).map((row) => mapLedger(row, members, userId)),
      members,
      invitations: ((invitationsResult.data ?? []) as Row[]).map(mapInvitation),
      categories: ((categoriesResult.data ?? []) as Row[]).map(mapCategory),
      paymentMethods: [],
      transactions: ((transactionsResult.data ?? []) as Row[]).map(mapTransaction),
      smsCandidates: [],
      cardMessageSamples: ((samplesResult.data ?? []) as Row[]).map(mapSample),
    }
  }

  async saveTransaction(userId: string, input: RemoteTransactionInput): Promise<void> {
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
      source_type: input.sourceType ?? "manual",
      source_hash: input.sourceHash ?? null,
      parse_confidence: input.parseConfidence ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    const result = input.id
      ? await client.from("transactions").update(payload).eq("id", input.id)
      : await client.from("transactions").insert({ ...payload, created_by: userId })
    throwIfError(result.error)
  }

  async softDeleteTransaction(transactionId: string, userId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client
      .from("transactions")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", transactionId)
    throwIfError(error)
  }

  async createExpenseCategory(input: {
    ledgerId: string
    userId: string
    name: string
    icon: string
    color: string
    sortOrder: number
  }): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.from("categories").insert({
      ledger_id: input.ledgerId,
      created_by: input.userId,
      type: "expense",
      name: input.name,
      icon: input.icon,
      color: input.color,
      sort_order: input.sortOrder,
      is_default: false,
    })
    throwIfError(error)
  }

  async updateCategory(categoryId: string, patch: Partial<Pick<Category, "name" | "icon" | "color" | "isArchived">>): Promise<void> {
    const client = requireSupabaseClient()
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.name !== undefined) payload.name = patch.name
    if (patch.icon !== undefined) payload.icon = patch.icon
    if (patch.color !== undefined) payload.color = patch.color
    if (patch.isArchived !== undefined) payload.is_archived = patch.isArchived

    const { error } = await client.from("categories").update(payload).eq("id", categoryId)
    throwIfError(error)
  }

  async createSharedLedger(name: string): Promise<string> {
    const client = requireSupabaseClient()
    const { data, error } = await client.rpc("create_shared_ledger", { ledger_name: name })
    throwIfError(error)
    if (typeof data !== "string") {
      throw new Error("공동 가계부 생성 결과를 확인할 수 없습니다.")
    }

    return data
  }

  async createInvite(input: { ledgerId: string; userId: string; inviteCode: string; inviteTokenHash: string }): Promise<void> {
    const client = requireSupabaseClient()
    const now = new Date()
    const { error } = await client.from("ledger_invitations").insert({
      ledger_id: input.ledgerId,
      invited_by: input.userId,
      invite_code: input.inviteCode,
      invite_token_hash: input.inviteTokenHash,
      role_to_grant: "member",
      status: "active",
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    throwIfError(error)
  }

  async revokeInvite(invitationId: string): Promise<void> {
    const client = requireSupabaseClient()
    const { error } = await client.from("ledger_invitations").update({ status: "revoked" }).eq("id", invitationId)
    throwIfError(error)
  }

  async submitCardMessageSample(userId: string, input: RemoteSampleInput): Promise<void> {
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
  const ownMembership = members.find((member) => member.ledgerId === id && member.userId === userId)
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
    nickname: optionalString(row.nickname) ?? (stringValue(row.user_id) === userId ? profile.nickname : "공동 멤버"),
    role: mapRole(row.role),
    status: row.status === "removed" ? "removed" : "active",
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

function mapCategory(row: Row): Category {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: optionalString(row.created_by),
    type: mapTransactionType(row.type),
    name: optionalString(row.name) ?? "카테고리",
    icon: optionalString(row.icon) ?? "circle",
    color: optionalString(row.color) ?? "#6c757d",
    sortOrder: numberValue(row.sort_order),
    isDefault: Boolean(row.is_default),
    isArchived: Boolean(row.is_archived),
  }
}

function mapTransaction(row: Row): Transaction {
  return {
    id: stringValue(row.id),
    ledgerId: stringValue(row.ledger_id),
    createdBy: stringValue(row.created_by),
    updatedBy: optionalString(row.updated_by),
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
    parseConfidence: row.parse_confidence === null ? undefined : numberValue(row.parse_confidence),
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
    expectedAmount: row.expected_amount === null ? undefined : numberValue(row.expected_amount),
    expectedMerchantName: optionalString(row.expected_merchant_name),
    expectedTransactionAt: optionalString(row.expected_transaction_at),
    parseResult: (row.parse_result as CardMessageSample["parseResult"]) ?? undefined,
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
  return value === "owner" || value === "admin" || value === "viewer" ? value : "member"
}

function mapTransactionType(value: unknown): TransactionType {
  return value === "income" || value === "transfer" ? value : "expense"
}

function mapTransactionStatus(value: unknown): TransactionStatus {
  return value === "pending" || value === "excluded" ? value : "confirmed"
}

function mapSourceType(value: unknown): TransactionSourceType {
  return value === "android_sms_notification" || value === "paste" || value === "import" ? value : "manual"
}

function mapInvitationStatus(value: unknown): LedgerInvitation["status"] {
  return value === "accepted" || value === "expired" || value === "revoked" ? value : "active"
}

function mapInvitationRole(value: unknown): LedgerInvitation["roleToGrant"] {
  return value === "admin" || value === "viewer" ? value : "member"
}

function mapSampleStatus(value: unknown): CardMessageSample["status"] {
  return value === "reviewing" || value === "applied" || value === "rejected" ? value : "submitted"
}
