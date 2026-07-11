export type Currency = "KRW"

export type LedgerType = "personal" | "shared"
export type LedgerRole = "owner" | "admin" | "member" | "viewer"
export type TransactionType = "expense" | "income" | "transfer"
export type TransactionStatus = "pending" | "confirmed" | "excluded"
export type TransactionSourceType =
  | "manual"
  | "android_sms_notification"
  | "paste"
  | "import"

export type SmsCandidateStatus =
  | "detected"
  | "notified"
  | "deferred"
  | "opened"
  | "registered"
  | "ignored"
  | "auto_registered_other"
  | "needs_review"

export interface Profile {
  id: string
  kakaoId?: string
  nickname: string
  avatarUrl?: string
  defaultCurrency: Currency
  timezone: string
}

export interface Ledger {
  id: string
  ownerId: string
  name: string
  type: LedgerType
  currency: Currency
  role: LedgerRole
}

export interface LedgerMember {
  id: string
  ledgerId: string
  userId: string
  nickname: string
  role: LedgerRole
  status: "active" | "removed"
  joinedAt: string
}

export interface LedgerInvitation {
  id: string
  ledgerId: string
  invitedBy: string
  inviteCode: string
  roleToGrant: Exclude<LedgerRole, "owner">
  status: "active" | "accepted" | "expired" | "revoked"
  expiresAt: string
  createdAt: string
}

export interface Category {
  id: string
  ledgerId: string
  createdBy?: string
  type: TransactionType
  name: string
  icon: string
  color: string
  sortOrder: number
  isDefault: boolean
  isArchived: boolean
}

export interface CategoryBudget {
  id: string
  ledgerId: string
  categoryId: string
  effectiveMonth: string
  amount: number
  createdAt: string
}

export type RecurringRuleType = "fixed" | "installment"

export interface RecurringRule {
  id: string
  ledgerId: string
  createdBy: string
  type: RecurringRuleType
  amount: number
  dayOfMonth: number
  timeOfDay: string
  startMonth: string
  endMonth?: string
  inactiveFromMonth?: string
  installmentMonths?: number
  categoryId?: string
  merchantName?: string
  memo?: string
  isActive: boolean
  createdAt: string
}

export interface PaymentMethod {
  id: string
  ledgerId: string
  ownerUserId?: string
  name: string
  type: "cash" | "card" | "bank" | "pay" | "etc"
  last4?: string
  issuer?: string
  visibility: "ledger" | "private"
  isActive: boolean
}

export interface Transaction {
  id: string
  ledgerId: string
  createdBy: string
  updatedBy?: string
  actorUserId?: string
  recurringRuleId?: string
  recurringType?: RecurringRuleType
  installmentNumber?: number
  installmentTotal?: number
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: Currency
  transactionAt: string
  categoryId?: string
  paymentMethodId?: string
  merchantName?: string
  memo?: string
  sourceType: TransactionSourceType
  sourceApp?: string
  sourceSender?: string
  sourceHash?: string
  parseConfidence?: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface ParsedTransaction {
  type: TransactionType
  amount: number
  currency: Currency
  transactionAt: string
  merchantName?: string
  paymentMethodName?: string
  targetLedgerId?: string
  sourceApp?: string
  sourceSender?: string
  confidence: number
  normalizedHash: string
  rawTextMasked?: string
}

export interface LocalSmsCandidate {
  id: string
  userId: string
  targetLedgerId?: string
  sourceHash: string
  sourceApp?: string
  sourceSender?: string
  rawMessageEncrypted?: string
  rawMessage?: string
  maskedMessage: string
  parsed: ParsedTransaction
  status: SmsCandidateStatus
  promptCount: number
  firstDetectedAt: string
  lastPromptedAt?: string
  reviewDeadlineAt: string
}

export interface CardMessageSample {
  id: string
  submittedBy: string
  cardCompanyName?: string
  maskedMessage: string
  expectedAmount?: number
  expectedMerchantName?: string
  expectedTransactionAt?: string
  parseResult?: ParsedTransaction
  consentVersion: string
  status: "submitted" | "reviewing" | "applied" | "rejected"
  createdAt: string
}
