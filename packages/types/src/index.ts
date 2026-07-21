export type Currency = "KRW"

export type LedgerType = "personal" | "shared"
export type LedgerRole = "owner" | "admin" | "member" | "viewer"
export type TransactionType = "expense" | "income" | "saving"
export type IncomeKind = "salary" | "side_income"
export type CategoryUsageType = "expense" | "income" | "saving"
export type TransactionStatus = "confirmed" | "excluded"
export type TransactionSourceType =
  | "manual"
  | "android_sms_notification"
  | "paste"
  | "import"
  | "receipt_ai"

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

export interface AccountDeletionRequest {
  userId: string
  requestedAt: string
  purgeAfter: string
}

export const CURRENT_TERMS_VERSION = "2026-07-19-v1"
export const CURRENT_PRIVACY_VERSION = "2026-07-19-v1"

export interface LegalConsent {
  userId: string
  termsVersion: string
  privacyVersion: string
  acceptedAt: string
}

export interface Ledger {
  id: string
  ownerId: string
  name: string
  type: LedgerType
  currency: Currency
  role: LedgerRole
  archivedAt?: string
  purgeAfter?: string
}

export interface LedgerMember {
  id: string
  ledgerId: string
  userId: string
  nickname: string
  role: LedgerRole
  status: "active" | "removed"
  isDefault: boolean
  joinedAt: string
}

export interface LedgerMemberEvent {
  id: string
  ledgerId: string
  actorUserId?: string
  targetUserId?: string
  action: "role_changed" | "removed" | "ownership_transferred"
  previousRole?: LedgerRole
  nextRole?: LedgerRole
  createdAt: string
}

export interface LedgerInvitation {
  id: string
  ledgerId: string
  invitedBy: string
  inviteCode?: string
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
  usageTypes: CategoryUsageType[]
  name: string
  icon: string
  color: string
  sortOrder: number
  isDefault: boolean
  isArchived: boolean
  parentCategoryId?: string
}

export interface CategoryBudget {
  id: string
  ledgerId: string
  categoryId: string
  effectiveMonth: string
  amount: number
  createdAt: string
}

export interface LedgerMonthNote {
  id: string
  ledgerId: string
  month: string
  note: string
  updatedBy?: string
  updatedAt: string
}

export type RecurringRuleType = "fixed" | "installment"

export interface RecurringRule {
  id: string
  ledgerId: string
  createdBy?: string
  type: RecurringRuleType
  transactionType: TransactionType
  incomeKind?: IncomeKind
  amount: number
  dayOfMonth: number
  timeOfDay: string
  startMonth: string
  endMonth?: string
  inactiveFromMonth?: string
  installmentMonths?: number
  installmentAmountType?: "monthly" | "principal"
  installmentPrincipal?: number
  purchaseAt?: string
  paymentMethodId?: string
  categoryId?: string
  merchantName?: string
  memo?: string
  isActive: boolean
  createdAt: string
}

export interface PaymentMethod {
  id: string
  instrumentId: string
  ledgerId: string
  ownerUserId?: string
  name: string
  type: "cash" | "card" | "bank" | "pay" | "etc"
  last4?: string
  issuer?: string
  paymentDay?: number
  billingPeriodEndDay?: number
  billingPeriodEndMonthOffset?: -1 | 0
  visibility: "ledger" | "private"
  isActive: boolean
  isDeleted?: boolean
  isPrimary?: boolean
  isDebit?: boolean
}

export interface PaymentInstrument {
  id: string
  ownerUserId: string
  name: string
  type: "cash" | "card" | "bank" | "pay" | "etc"
  last4?: string
  issuer?: string
  paymentDay?: number
  billingPeriodEndDay?: number
  billingPeriodEndMonthOffset?: -1 | 0
  isActive: boolean
  isDeleted?: boolean
  isDebit?: boolean
}

export interface Transaction {
  id: string
  ledgerId: string
  createdBy?: string
  updatedBy?: string
  actorUserId?: string
  recurringRuleId?: string
  recurringType?: RecurringRuleType
  installmentNumber?: number
  installmentTotal?: number
  type: TransactionType
  incomeKind?: IncomeKind
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
  tags?: string[]
}

export interface TransactionSplit {
  id: string
  transactionId: string
  categoryId: string
  amount: number
  sortOrder: number
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

export interface ReceiptParseResult {
  amount: number
  merchantName: string
  transactionAt: string
  categoryHint?: string
  memo?: string
  paymentLast4?: string
  confidence: number
  warnings: string[]
  provider: "gemini"
  model: string
  dataTier: "free" | "paid"
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
