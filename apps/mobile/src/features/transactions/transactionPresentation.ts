import {
  getCategoryLabel,
  getDescendantCategoryIds,
  toDateKey,
  toMonthKey,
} from "@salimon/domain"
import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionSplit,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"

export type TransactionPeriod = "all" | "7" | "14" | "28"

export interface MobileTransactionFilters {
  actorUserId: string
  categoryId: string
  keyword: string
  period: TransactionPeriod
  status: "" | TransactionStatus
  type: "" | TransactionType
}

export interface TransactionFilterContext {
  categories: Category[]
  now?: Date
  selectedMonth: string
  transactionSplits: TransactionSplit[]
}

export interface TransactionDateSection {
  data: Transaction[]
  date: string
  expense: number
  income: number
  saving: number
  title: string
}

export interface TransactionTotals {
  expense: number
  income: number
  saving: number
}

export const defaultTransactionFilters: MobileTransactionFilters = {
  actorUserId: "",
  categoryId: "",
  keyword: "",
  period: "all",
  status: "",
  type: "",
}

export function filterTransactions(
  transactions: Transaction[],
  filters: MobileTransactionFilters,
  context: TransactionFilterContext,
): Transaction[] {
  const startDate = resolvePeriodStart(
    context.selectedMonth,
    filters.period,
    context.now,
  )
  const query = filters.keyword.trim().toLocaleLowerCase("ko-KR")
  const selectedCategoryIds = filters.categoryId
    ? getDescendantCategoryIds(context.categories, filters.categoryId)
    : undefined
  const splitsByTransaction = new Map<string, TransactionSplit[]>()
  for (const split of context.transactionSplits) {
    const splits = splitsByTransaction.get(split.transactionId) ?? []
    splits.push(split)
    splitsByTransaction.set(split.transactionId, splits)
  }

  return transactions
    .filter((transaction) => {
      if (
        startDate &&
        toDateKey(new Date(transaction.transactionAt)) < startDate
      ) {
        return false
      }
      if (filters.type && transaction.type !== filters.type) return false
      if (filters.status && transaction.status !== filters.status) return false
      if (
        filters.actorUserId &&
        (filters.actorUserId === "common"
          ? Boolean(transaction.actorUserId)
          : transaction.actorUserId !== filters.actorUserId)
      ) {
        return false
      }
      if (selectedCategoryIds) {
        const splits = splitsByTransaction.get(transaction.id) ?? []
        const matchesCategory =
          splits.length > 0
            ? splits.some((split) => selectedCategoryIds.has(split.categoryId))
            : Boolean(
                transaction.categoryId &&
                selectedCategoryIds.has(transaction.categoryId),
              )
        if (!matchesCategory) return false
      }
      if (query) {
        const searchableText = `${transaction.merchantName ?? ""} ${
          transaction.memo ?? ""
        } ${(transaction.tags ?? []).join(" ")}`.toLocaleLowerCase("ko-KR")
        if (!searchableText.includes(query)) return false
      }
      return true
    })
    .sort(
      (first, second) =>
        new Date(second.transactionAt).getTime() -
        new Date(first.transactionAt).getTime(),
    )
}

export function groupTransactionsByDate(
  transactions: Transaction[],
): TransactionDateSection[] {
  const grouped = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const date = toDateKey(new Date(transaction.transactionAt))
    const items = grouped.get(date) ?? []
    items.push(transaction)
    grouped.set(date, items)
  }

  return [...grouped.entries()].map(([date, data]) => {
    const totals = calculateTransactionTotals(data)
    return {
      data,
      date,
      ...totals,
      title: formatSectionDate(date),
    }
  })
}

export function calculateTransactionTotals(
  transactions: Transaction[],
): TransactionTotals {
  return transactions.reduce<TransactionTotals>(
    (totals, transaction) => {
      if (transaction.status === "confirmed" && !transaction.deletedAt) {
        totals[transaction.type] += transaction.amount
      }
      return totals
    },
    { expense: 0, income: 0, saving: 0 },
  )
}

export function transactionTypeLabel(type: TransactionType): string {
  if (type === "income") return "수입"
  if (type === "saving") return "저축"
  return "지출"
}

export function transactionStatusLabel(status: TransactionStatus): string {
  return status === "excluded" ? "합계 제외" : "확정"
}

export function transactionMemberLabel(
  userId: string | undefined,
  members: LedgerMember[],
  fallback: string,
): string {
  if (!userId) return fallback
  return (
    members.find((member) => member.userId === userId)?.nickname ??
    "알 수 없는 멤버"
  )
}

export function transactionPaymentLabel(
  transaction: Transaction,
  paymentMethod?: PaymentMethod,
): string | undefined {
  if (paymentMethod) {
    const parts = [
      paymentMethod.issuer,
      paymentMethod.name,
      paymentMethod.last4 ? `끝 ${paymentMethod.last4}` : undefined,
      paymentMethod.isDeleted ? "삭제된 결제수단" : undefined,
    ].filter(Boolean)
    return parts.join(" · ")
  }
  if (transaction.paymentMethodId) return "삭제되었거나 비공개인 결제수단"
  return transaction.type === "expense" ? "현금" : undefined
}

export function transactionRecurrenceLabel(
  transaction: Transaction,
): string | undefined {
  if (transaction.recurringType === "fixed") return "고정 거래"
  if (transaction.recurringType !== "installment") return undefined
  if (transaction.installmentNumber && transaction.installmentTotal) {
    return `할부 ${transaction.installmentNumber}/${transaction.installmentTotal}회`
  }
  return "할부 거래"
}

export function transactionSourceLabel(
  sourceType: Transaction["sourceType"],
): string {
  if (sourceType === "android_sms_notification") return "Android 알림"
  if (sourceType === "paste") return "붙여넣기"
  if (sourceType === "import") return "가져오기"
  if (sourceType === "receipt_ai") return "영수증 분석"
  return "직접 등록"
}

export function transactionCategoryLabel(
  transaction: Transaction,
  categories: Category[],
): string {
  const category = categories.find((item) => item.id === transaction.categoryId)
  const label = getCategoryLabel(categories, transaction.categoryId, "미분류")
  return category?.isArchived ? `${label} · 보관됨` : label
}

function resolvePeriodStart(
  selectedMonth: string,
  period: TransactionPeriod,
  now = new Date(),
): string | undefined {
  if (period === "all") return undefined
  const [year, month] = selectedMonth.split("-").map(Number)
  const currentMonth = toMonthKey(now)
  const anchor =
    selectedMonth === currentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(year, month, 0)
  anchor.setDate(anchor.getDate() - Number(period) + 1)
  return toDateKey(anchor)
}

function formatSectionDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(new Date(year, month - 1, day))
  return `${month}월 ${day}일 ${weekday}`
}
