import {
  getDescendantCategoryIds,
  toMonthKey,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import type {
  Category,
  CategoryBudget,
  LedgerMember,
  LedgerRole,
  PaymentMethod,
  Transaction,
  TransactionSplit,
} from "@salimon/types"

export interface SettlementTotals {
  expense: number
  income: number
  saving: number
}

export interface SettlementMemberRow {
  actorExpense: number
  actorTransactionCount: number
  member: LedgerMember
  registeredTransactionCount: number
}

export interface SettlementUnassignedRow {
  amount: number
  label: string
  transactionCount: number
}

export interface SettlementCategoryRow {
  budget: number
  category: Category
  spent: number
}

export interface SettlementWeekRow {
  amount: number
  count: number
  endDay: number
  label: string
  startDay: number
}

export interface MobileSettlementSummary {
  categoryRows: SettlementCategoryRow[]
  confirmedCount: number
  excludedCount: number
  excludedExpense: number
  fixedExpense: number
  memberRows: SettlementMemberRow[]
  recentTransactions: Transaction[]
  totals: SettlementTotals
  unassignedRows: SettlementUnassignedRow[]
  variableExpense: number
  weekRows: SettlementWeekRow[]
}

export interface MobileSettlementInput {
  budgets: CategoryBudget[]
  categories: Category[]
  ledgerId: string
  members: LedgerMember[]
  month: string
  splits: TransactionSplit[]
  transactions: Transaction[]
}

export interface SettlementRoleAccess {
  canEditMonthNote: boolean
  canEditTransactions: boolean
  label: string
}

export interface VisiblePaymentMethodSummary {
  ledgerVisibleCount: number
  privateOwnedCount: number
}

export function buildMobileSettlementSummary({
  budgets,
  categories,
  ledgerId,
  members,
  month,
  splits,
  transactions,
}: MobileSettlementInput): MobileSettlementSummary {
  const monthTransactions = transactions
    .filter(
      (transaction) =>
        transaction.ledgerId === ledgerId &&
        !transaction.deletedAt &&
        toMonthKey(new Date(transaction.transactionAt)) === month,
    )
    .sort(
      (first, second) =>
        new Date(second.transactionAt).getTime() -
        new Date(first.transactionAt).getTime(),
    )
  const confirmedTransactions = monthTransactions.filter(
    (transaction) => transaction.status === "confirmed",
  )
  const confirmedExpenses = confirmedTransactions.filter(
    (transaction) => transaction.type === "expense",
  )
  const excludedTransactions = monthTransactions.filter(
    (transaction) => transaction.status === "excluded",
  )
  const totals = {
    expense: sumTransactionsByType(confirmedTransactions, "expense"),
    income: sumTransactionsByType(confirmedTransactions, "income"),
    saving: sumTransactionsByType(confirmedTransactions, "saving"),
  }
  const fixedExpense = confirmedExpenses
    .filter((transaction) => transaction.recurringType === "fixed")
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const activeMembers = members.filter(
    (member) => member.ledgerId === ledgerId && member.status === "active",
  )
  const activeMemberIds = new Set(activeMembers.map((member) => member.userId))
  const memberRows = activeMembers
    .map((member) => ({
      member,
      actorExpense: confirmedExpenses
        .filter((transaction) => transaction.actorUserId === member.userId)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      actorTransactionCount: confirmedExpenses.filter(
        (transaction) => transaction.actorUserId === member.userId,
      ).length,
      registeredTransactionCount: monthTransactions.filter(
        (transaction) => transaction.createdBy === member.userId,
      ).length,
    }))
    .sort(
      (first, second) =>
        second.actorExpense - first.actorExpense ||
        first.member.nickname.localeCompare(second.member.nickname, "ko-KR"),
    )
  const commonExpenses = confirmedExpenses.filter(
    (transaction) => !transaction.actorUserId,
  )
  const unknownActorExpenses = confirmedExpenses.filter(
    (transaction) =>
      Boolean(transaction.actorUserId) &&
      !activeMemberIds.has(transaction.actorUserId ?? ""),
  )
  const unassignedRows = [
    {
      label: "공통 거래",
      amount: commonExpenses.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      ),
      transactionCount: commonExpenses.length,
    },
    {
      label: "탈퇴한 멤버 또는 알 수 없음",
      amount: unknownActorExpenses.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      ),
      transactionCount: unknownActorExpenses.length,
    },
  ].filter((row) => row.transactionCount > 0)

  const ledgerCategories = categories.filter(
    (category) => category.ledgerId === ledgerId,
  )
  const categoryRows = ledgerCategories
    .filter(
      (category) =>
        !category.isArchived &&
        !category.parentCategoryId &&
        category.usageTypes.includes("expense"),
    )
    .map((category) => {
      const categoryIds = getDescendantCategoryIds(
        ledgerCategories,
        category.id,
      )
      const spent = confirmedExpenses.reduce(
        (sum, transaction) =>
          sum +
          transactionAmountForCategoryIds(transaction, splits, categoryIds),
        0,
      )
      const budget = budgets
        .filter(
          (item) =>
            item.ledgerId === ledgerId &&
            item.categoryId === category.id &&
            item.effectiveMonth <= month,
        )
        .sort((first, second) =>
          second.effectiveMonth.localeCompare(first.effectiveMonth),
        )[0]?.amount

      return { category, spent, budget: budget ?? 0 }
    })
    .filter((row) => row.spent > 0 || row.budget > 0)
    .sort((first, second) => second.spent - first.spent)

  return {
    categoryRows,
    confirmedCount: confirmedTransactions.length,
    excludedCount: excludedTransactions.length,
    excludedExpense: sumTransactionsByType(excludedTransactions, "expense"),
    fixedExpense,
    memberRows,
    recentTransactions: monthTransactions.slice(0, 8),
    totals,
    unassignedRows,
    variableExpense: totals.expense - fixedExpense,
    weekRows: buildWeekRows(month, confirmedExpenses),
  }
}

export function getSettlementRoleAccess(
  role: LedgerRole,
): SettlementRoleAccess {
  const canEdit = role !== "viewer"
  return {
    canEditMonthNote: canEdit,
    canEditTransactions: canEdit,
    label:
      role === "owner"
        ? "소유자"
        : role === "admin"
          ? "관리자"
          : role === "member"
            ? "구성원"
            : "조회자",
  }
}

export function summarizeVisiblePaymentMethods(
  paymentMethods: PaymentMethod[],
  ledgerId: string,
  userId: string,
): VisiblePaymentMethodSummary {
  const visibleMethods = paymentMethods.filter(
    (method) =>
      method.ledgerId === ledgerId &&
      !method.isDeleted &&
      (method.visibility === "ledger" || method.ownerUserId === userId),
  )

  return {
    ledgerVisibleCount: visibleMethods.filter(
      (method) => method.visibility === "ledger",
    ).length,
    privateOwnedCount: visibleMethods.filter(
      (method) =>
        method.visibility === "private" && method.ownerUserId === userId,
    ).length,
  }
}

export function settlementMemberName(
  members: LedgerMember[],
  userId: string | undefined,
  fallback: string,
): string {
  if (!userId) return fallback
  return (
    members.find((member) => member.userId === userId)?.nickname ??
    "탈퇴한 멤버 또는 알 수 없음"
  )
}

function buildWeekRows(
  month: string,
  confirmedExpenses: Transaction[],
): SettlementWeekRow[] {
  const [year, monthNumber] = month.split("-").map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  return Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
    const startDay = index * 7 + 1
    const endDay = Math.min(daysInMonth, startDay + 6)
    const weekTransactions = confirmedExpenses.filter((transaction) => {
      const day = new Date(transaction.transactionAt).getDate()
      return day >= startDay && day <= endDay
    })

    return {
      label: `${index + 1}주차`,
      startDay,
      endDay,
      count: weekTransactions.length,
      amount: weekTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      ),
    }
  })
}

function sumTransactionsByType(
  transactions: Transaction[],
  type: Transaction["type"],
): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}
