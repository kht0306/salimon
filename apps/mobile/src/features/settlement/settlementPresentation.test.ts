import type {
  Category,
  CategoryBudget,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionSplit,
} from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  buildSettlementExpenseTrend,
  buildMobileSettlementSummary,
  getSettlementTrendRange,
  getSettlementRoleAccess,
  settlementMemberName,
  summarizeVisiblePaymentMethods,
} from "./settlementPresentation"

const members: LedgerMember[] = [
  createMember("member-1", "user-1", "김살림", "owner"),
  createMember("member-2", "user-2", "이온", "viewer"),
]

const categories: Category[] = [
  createCategory("living", "생활비"),
  createCategory("food", "식비", "living"),
  createCategory("income", "수입", undefined, "income"),
]

const budgets: CategoryBudget[] = [
  {
    id: "budget-old",
    ledgerId: "ledger-1",
    categoryId: "living",
    effectiveMonth: "2026-07",
    amount: 300_000,
    createdAt: "2026-07-01T00:00:00+09:00",
  },
  {
    id: "budget-current",
    ledgerId: "ledger-1",
    categoryId: "living",
    effectiveMonth: "2026-08",
    amount: 350_000,
    createdAt: "2026-08-01T00:00:00+09:00",
  },
]

const transactions: Transaction[] = [
  createTransaction("fixed", "expense", 100_000, 2, {
    actorUserId: "user-1",
    categoryId: "living",
    createdBy: "user-2",
    recurringType: "fixed",
  }),
  createTransaction("split", "expense", 60_000, 9, {
    actorUserId: "user-2",
    categoryId: "living",
    createdBy: "user-1",
  }),
  createTransaction("common", "expense", 40_000, 16, {
    categoryId: "food",
    createdBy: "user-1",
  }),
  createTransaction("income", "income", 500_000, 20, {
    actorUserId: "user-1",
    categoryId: "income",
  }),
  createTransaction("excluded", "expense", 30_000, 25, {
    actorUserId: "user-2",
    categoryId: "living",
    status: "excluded",
  }),
  createTransaction("previous", "expense", 999_000, 10, {
    transactionAt: "2026-07-10T12:00:00+09:00",
  }),
]

const splits: TransactionSplit[] = [
  {
    id: "split-1",
    transactionId: "split",
    categoryId: "food",
    amount: 60_000,
    sortOrder: 0,
  },
]

describe("mobile settlement presentation", () => {
  it("matches the selected month confirmed and excluded settlement rules", () => {
    const summary = buildSummary()

    expect(summary.totals).toEqual({
      expense: 200_000,
      income: 500_000,
      saving: 0,
    })
    expect(summary.confirmedCount).toBe(4)
    expect(summary.excludedCount).toBe(1)
    expect(summary.excludedExpense).toBe(30_000)
    expect(summary.fixedExpense).toBe(100_000)
    expect(summary.variableExpense).toBe(100_000)
    expect(summary.recentTransactions.map((item) => item.id)).not.toContain(
      "previous",
    )
  })

  it("separates transaction actor totals from registrant counts", () => {
    const summary = buildSummary()
    const owner = summary.memberRows.find(
      (row) => row.member.userId === "user-1",
    )
    const viewer = summary.memberRows.find(
      (row) => row.member.userId === "user-2",
    )

    expect(owner).toMatchObject({
      actorExpense: 100_000,
      actorTransactionCount: 1,
      registeredTransactionCount: 4,
    })
    expect(viewer).toMatchObject({
      actorExpense: 60_000,
      actorTransactionCount: 1,
      registeredTransactionCount: 1,
    })
    expect(summary.unassignedRows).toEqual([
      { label: "공통 거래", amount: 40_000, transactionCount: 1 },
    ])
  })

  it("includes child and split amounts in the parent category total", () => {
    const summary = buildSummary()

    expect(summary.categoryRows).toHaveLength(1)
    expect(summary.categoryRows[0]).toMatchObject({
      budget: 350_000,
      spent: 200_000,
    })
    expect(summary.categoryRows[0]?.category.id).toBe("living")
  })

  it("groups confirmed expenses by seven-day week ranges", () => {
    const summary = buildSummary()

    expect(summary.weekRows).toMatchObject([
      { label: "1주차", startDay: 1, endDay: 7, count: 1, amount: 100_000 },
      { label: "2주차", startDay: 8, endDay: 14, count: 1, amount: 60_000 },
      { label: "3주차", startDay: 15, endDay: 21, count: 1, amount: 40_000 },
      { label: "4주차", startDay: 22, endDay: 28, count: 0, amount: 0 },
      { label: "5주차", startDay: 29, endDay: 31, count: 0, amount: 0 },
    ])
  })

  it("builds a confirmed expense trend for the selected month and two prior months", () => {
    const trend = buildSettlementExpenseTrend(
      [
        ...transactions,
        createTransaction("june", "expense", 80_000, 10, {
          transactionAt: "2026-06-10T12:00:00+09:00",
        }),
      ],
      "ledger-1",
      "2026-08",
    )

    expect(trend).toEqual([
      { month: "2026-06", label: "6월", amount: 80_000 },
      { month: "2026-07", label: "7월", amount: 999_000 },
      { month: "2026-08", label: "8월", amount: 200_000 },
    ])
    expect(getSettlementTrendRange("2026-02")).toEqual({
      startDate: "2025-12-01",
      endDate: "2026-02-28",
    })
  })

  it("maps the role matrix and blocks viewer writes", () => {
    expect(getSettlementRoleAccess("owner")).toEqual({
      label: "소유자",
      canEditMonthNote: true,
      canEditTransactions: true,
    })
    expect(getSettlementRoleAccess("admin").canEditTransactions).toBe(true)
    expect(getSettlementRoleAccess("member").canEditMonthNote).toBe(true)
    expect(getSettlementRoleAccess("viewer")).toEqual({
      label: "조회자",
      canEditMonthNote: false,
      canEditTransactions: false,
    })
  })

  it("never counts another member's private payment method", () => {
    const paymentMethods: PaymentMethod[] = [
      createPaymentMethod("shared", "user-2", "ledger"),
      createPaymentMethod("mine", "user-1", "private"),
      createPaymentMethod("other-private", "user-2", "private"),
    ]

    expect(
      summarizeVisiblePaymentMethods(paymentMethods, "ledger-1", "user-1"),
    ).toEqual({
      ledgerVisibleCount: 1,
      privateOwnedCount: 1,
    })
  })

  it("uses a safe label when an actor or registrant has left", () => {
    expect(settlementMemberName(members, undefined, "공통")).toBe("공통")
    expect(settlementMemberName(members, "user-2", "공통")).toBe("이온")
    expect(settlementMemberName(members, "removed-user", "공통")).toBe(
      "탈퇴한 멤버 또는 알 수 없음",
    )
  })
})

function buildSummary() {
  return buildMobileSettlementSummary({
    budgets,
    categories,
    ledgerId: "ledger-1",
    members,
    month: "2026-08",
    splits,
    transactions,
  })
}

function createMember(
  id: string,
  userId: string,
  nickname: string,
  role: LedgerMember["role"],
): LedgerMember {
  return {
    id,
    ledgerId: "ledger-1",
    userId,
    nickname,
    role,
    status: "active",
    isDefault: userId === "user-1",
    joinedAt: "2026-08-01T00:00:00+09:00",
  }
}

function createCategory(
  id: string,
  name: string,
  parentCategoryId?: string,
  type: Category["type"] = "expense",
): Category {
  return {
    id,
    ledgerId: "ledger-1",
    type,
    usageTypes: [type],
    name,
    icon: "circle",
    color: type === "expense" ? "#0f766e" : "#2563eb",
    sortOrder: 0,
    isDefault: true,
    isArchived: false,
    parentCategoryId,
  }
}

function createTransaction(
  id: string,
  type: Transaction["type"],
  amount: number,
  day: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  const transactionAt = `2026-08-${String(day).padStart(2, "0")}T12:00:00+09:00`
  return {
    id,
    ledgerId: "ledger-1",
    createdBy: "user-1",
    type,
    status: "confirmed",
    amount,
    currency: "KRW",
    transactionAt,
    sourceType: "manual",
    createdAt: transactionAt,
    updatedAt: transactionAt,
    ...overrides,
  }
}

function createPaymentMethod(
  id: string,
  ownerUserId: string,
  visibility: PaymentMethod["visibility"],
): PaymentMethod {
  return {
    id,
    instrumentId: `instrument-${id}`,
    ledgerId: "ledger-1",
    ownerUserId,
    name: id,
    type: "card",
    visibility,
    isActive: true,
  }
}
