import { toDateKey } from "@salimon/domain"
import type { LedgerMember, Transaction, TransactionType } from "@salimon/types"

export type DashboardTransactionGrouping = "actor" | "registrant" | "none"
export type DashboardTransactionRecurrenceKey = "recurring" | "general"

export interface DashboardRecurrenceListItem {
  collapsed: boolean
  count: number
  groupKey: DashboardTransactionRecurrenceKey
  key: string
  kind: "recurrence"
  label: string
}

export interface DashboardMemberListItem {
  count: number
  key: string
  kind: "member"
  label: string
}

export interface DashboardTransactionListItem {
  key: string
  kind: "transaction"
  transaction: Transaction
}

export type DashboardListItem =
  | DashboardRecurrenceListItem
  | DashboardMemberListItem
  | DashboardTransactionListItem

export interface TransactionTotals {
  expense: number
  income: number
  saving: number
}

export interface MonthDaySummary extends TransactionTotals {
  count: number
  date: string
  dayOfMonth: number
}

export function calculateConfirmedTotals(
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

export function buildMonthDaySummaries(
  monthKey: string,
  transactions: Transaction[],
): MonthDaySummary[] {
  const [year, month] = monthKey.split("-").map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const summaries = Array.from({ length: daysInMonth }, (_, index) => ({
    count: 0,
    date: `${monthKey}-${String(index + 1).padStart(2, "0")}`,
    dayOfMonth: index + 1,
    expense: 0,
    income: 0,
    saving: 0,
  }))
  const summaryByDate = new Map(
    summaries.map((summary) => [summary.date, summary]),
  )

  transactions.forEach((transaction) => {
    if (transaction.deletedAt) return
    const summary = summaryByDate.get(
      toDateKey(new Date(transaction.transactionAt)),
    )
    if (!summary) return

    summary.count += 1
    if (transaction.status === "confirmed") {
      summary[transaction.type] += transaction.amount
    }
  })

  return summaries
}

export function buildDashboardListItems(
  transactions: Transaction[],
  members: LedgerMember[],
  grouping: DashboardTransactionGrouping,
  collapsedGroupKeys: ReadonlySet<DashboardTransactionRecurrenceKey>,
): DashboardListItem[] {
  const recurrenceGroups: {
    key: DashboardTransactionRecurrenceKey
    label: string
    transactions: Transaction[]
  }[] = [
    {
      key: "recurring",
      label: "반복 거래",
      transactions: transactions.filter(
        (transaction) =>
          transaction.recurringType === "fixed" ||
          transaction.recurringType === "installment",
      ),
    },
    {
      key: "general",
      label: "일반 거래",
      transactions: transactions.filter(
        (transaction) =>
          transaction.recurringType !== "fixed" &&
          transaction.recurringType !== "installment",
      ),
    },
  ]
  const items: DashboardListItem[] = []

  for (const recurrenceGroup of recurrenceGroups) {
    if (recurrenceGroup.transactions.length === 0) continue

    const collapsed = collapsedGroupKeys.has(recurrenceGroup.key)
    items.push({
      collapsed,
      count: recurrenceGroup.transactions.length,
      groupKey: recurrenceGroup.key,
      key: `recurrence-${recurrenceGroup.key}`,
      kind: "recurrence",
      label: recurrenceGroup.label,
    })
    if (collapsed) continue

    const memberGroups = groupDashboardTransactions(
      recurrenceGroup.transactions,
      members,
      grouping,
    )
    for (const memberGroup of memberGroups) {
      if (grouping !== "none") {
        items.push({
          count: memberGroup.transactions.length,
          key: `member-${recurrenceGroup.key}-${memberGroup.key}`,
          kind: "member",
          label: memberGroup.label,
        })
      }
      for (const transaction of memberGroup.transactions) {
        items.push({
          key: `transaction-${transaction.id}`,
          kind: "transaction",
          transaction,
        })
      }
    }
  }

  return items
}

export function transactionTypeLabel(type: TransactionType): string {
  if (type === "income") return "수입"
  if (type === "saving") return "저축"
  return "지출"
}

interface DashboardMemberGroup {
  key: string
  label: string
  transactions: Transaction[]
}

function groupDashboardTransactions(
  transactions: Transaction[],
  members: LedgerMember[],
  grouping: DashboardTransactionGrouping,
): DashboardMemberGroup[] {
  if (grouping === "none") {
    return [{ key: "all", label: "", transactions }]
  }

  const grouped = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const key =
      grouping === "actor"
        ? (transaction.actorUserId ?? "common")
        : (transaction.createdBy ?? "unknown")
    grouped.set(key, [...(grouped.get(key) ?? []), transaction])
  }

  const preferredKeys =
    grouping === "actor"
      ? ["common", ...members.map((member) => member.userId)]
      : members.map((member) => member.userId)
  const orderedKeys = [...preferredKeys, ...grouped.keys()].filter(
    (key, index, keys) => keys.indexOf(key) === index && grouped.has(key),
  )

  return orderedKeys.map((key) => ({
    key,
    label:
      grouping === "actor" && key === "common"
        ? "공통"
        : (members.find((member) => member.userId === key)?.nickname ??
          (grouping === "registrant" && key === "unknown"
            ? "탈퇴한 멤버"
            : "알 수 없음")),
    transactions: grouped.get(key) ?? [],
  }))
}
