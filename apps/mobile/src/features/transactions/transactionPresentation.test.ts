import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionSplit,
} from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  calculateTransactionTotals,
  defaultTransactionFilters,
  filterTransactions,
  groupTransactionsByDate,
  transactionCategoryLabel,
  transactionMemberLabel,
  transactionPaymentLabel,
  transactionRecurrenceLabel,
  transactionStructureLabels,
  toggleTransactionFilterValue,
} from "./transactionPresentation"

const categories: Category[] = [
  createCategory("living", "생활비"),
  createCategory("food", "식비", "living"),
  { ...createCategory("archived", "예전 분류"), isArchived: true },
]

const transactions: Transaction[] = [
  createTransaction("recent", "expense", 12_000, 10, {
    actorUserId: "member-1",
    categoryId: "food",
    merchantName: "동네 마트",
    tags: ["주말"],
  }),
  createTransaction("split", "expense", 30_000, 8, {
    categoryId: "living",
    memo: "가족 저녁",
  }),
  createTransaction("income", "income", 500_000, 2, {
    status: "excluded",
  }),
]

const splits: TransactionSplit[] = [
  {
    id: "split-1",
    transactionId: "split",
    categoryId: "food",
    amount: 30_000,
    sortOrder: 0,
  },
]

const context = {
  categories,
  selectedMonth: "2026-08",
  transactionSplits: splits,
  now: new Date("2026-08-11T12:00:00+09:00"),
}

describe("mobile transaction presentation", () => {
  it("filters the selected month by a recent period", () => {
    const result = filterTransactions(
      transactions,
      { ...defaultTransactionFilters, period: "7" },
      context,
    )

    expect(result.map((transaction) => transaction.id)).toEqual([
      "recent",
      "split",
    ])
  })

  it("matches category descendants for direct and split transactions", () => {
    const result = filterTransactions(
      transactions,
      { ...defaultTransactionFilters, categoryIds: ["living"] },
      context,
    )

    expect(result.map((transaction) => transaction.id)).toEqual([
      "recent",
      "split",
    ])
  })

  it("matches the union of multiple selected category trees", () => {
    const result = filterTransactions(
      [
        ...transactions,
        createTransaction("archived-transaction", "expense", 8_000, 7, {
          categoryId: "archived",
        }),
      ],
      {
        ...defaultTransactionFilters,
        categoryIds: ["food", "archived"],
      },
      context,
    )

    expect(result.map((transaction) => transaction.id)).toEqual([
      "recent",
      "split",
      "archived-transaction",
    ])
  })

  it("filters by member, type, status and keyword", () => {
    const result = filterTransactions(
      transactions,
      {
        ...defaultTransactionFilters,
        actorUserId: "member-1",
        keyword: "주말",
        status: "confirmed",
        type: "expense",
      },
      context,
    )

    expect(result.map((transaction) => transaction.id)).toEqual(["recent"])
  })

  it("filters a custom multi-month range and selected payment methods", () => {
    const rangeTransactions = [
      createTransaction("july-card", "expense", 10_000, 10, {
        paymentMethodId: "card-1",
        transactionAt: "2026-07-31T12:00:00+09:00",
      }),
      createTransaction("august-cash", "expense", 20_000, 1),
      createTransaction("outside", "expense", 30_000, 3, {
        paymentMethodId: "card-1",
        transactionAt: "2026-08-03T12:00:00+09:00",
      }),
    ]

    expect(
      filterTransactions(
        rangeTransactions,
        {
          ...defaultTransactionFilters,
          endDate: "2026-08-02",
          paymentMethodIds: ["card-1"],
          period: "custom",
          startDate: "2026-07-30",
        },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["july-card"])
    expect(
      filterTransactions(
        rangeTransactions,
        {
          ...defaultTransactionFilters,
          endDate: "2026-08-02",
          paymentMethodIds: ["cash"],
          period: "custom",
          startDate: "2026-07-30",
        },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["august-cash"])
  })

  it("filters regular, fixed, installment and split transaction structures", () => {
    const structuredTransactions = [
      transactions[0]!,
      { ...transactions[0]!, id: "fixed", recurringType: "fixed" as const },
      {
        ...transactions[0]!,
        id: "installment",
        recurringType: "installment" as const,
      },
      transactions[1]!,
    ]

    expect(
      filterTransactions(
        structuredTransactions,
        { ...defaultTransactionFilters, structure: "regular" },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["recent"])
    expect(
      filterTransactions(
        structuredTransactions,
        { ...defaultTransactionFilters, structure: "fixed" },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["fixed"])
    expect(
      filterTransactions(
        structuredTransactions,
        { ...defaultTransactionFilters, structure: "installment" },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["installment"])
    expect(
      filterTransactions(
        structuredTransactions,
        { ...defaultTransactionFilters, structure: "split" },
        context,
      ).map((transaction) => transaction.id),
    ).toEqual(["split"])
  })

  it("groups transactions by date in descending input order", () => {
    const sections = groupTransactionsByDate(transactions)

    expect(sections.map((section) => section.date)).toEqual([
      "2026-08-10",
      "2026-08-08",
      "2026-08-02",
    ])
    expect(sections[0]?.expense).toBe(12_000)
  })

  it("excludes excluded transactions from totals", () => {
    expect(calculateTransactionTotals(transactions)).toEqual({
      expense: 42_000,
      income: 0,
      saving: 0,
    })
  })

  it("describes members, deleted payment methods and recurrence", () => {
    const members: LedgerMember[] = [
      {
        id: "ledger-member-1",
        ledgerId: "ledger-1",
        userId: "member-1",
        nickname: "가족",
        role: "member",
        status: "active",
        isDefault: false,
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    ]
    const paymentMethod: PaymentMethod = {
      id: "card-1",
      instrumentId: "instrument-1",
      ledgerId: "ledger-1",
      name: "생활비 카드",
      type: "card",
      issuer: "살림카드",
      last4: "1234",
      visibility: "ledger",
      isActive: false,
      isDeleted: true,
    }
    const installment = {
      ...transactions[0]!,
      paymentMethodId: "card-1",
      recurringType: "installment" as const,
      installmentNumber: 2,
      installmentTotal: 6,
    }

    expect(transactionMemberLabel("member-1", members, "공통")).toBe("가족")
    expect(transactionPaymentLabel(installment, paymentMethod)).toContain(
      "삭제된 결제수단",
    )
    expect(transactionRecurrenceLabel(installment)).toBe("할부 2/6회")
  })

  it("marks archived categories in detail labels", () => {
    expect(
      transactionCategoryLabel(
        { ...transactions[0]!, categoryId: "archived" },
        categories,
      ),
    ).toBe("예전 분류 · 보관됨")
  })

  it("resets an active filter and labels every complex transaction shape", () => {
    expect(toggleTransactionFilterValue("expense", "expense", "")).toBe("")
    expect(toggleTransactionFilterValue("", "expense", "")).toBe("expense")
    expect(
      transactionStructureLabels(
        {
          ...transactions[0]!,
          recurringType: "installment",
          installmentNumber: 2,
          installmentTotal: 6,
        },
        3,
      ),
    ).toEqual(["할부 2/6회", "분할 3개"])
  })

  it("keeps all 1,000 loaded transactions available for virtualized rendering", () => {
    const largeMonth = Array.from({ length: 1_000 }, (_, index) =>
      createTransaction(
        `large-${index}`,
        index % 2 === 0 ? "expense" : "income",
        1_000,
        (index % 28) + 1,
      ),
    )

    const filtered = filterTransactions(largeMonth, defaultTransactionFilters, {
      ...context,
      transactionSplits: [],
    })
    const sections = groupTransactionsByDate(filtered)

    expect(filtered).toHaveLength(1_000)
    expect(sections).toHaveLength(28)
    expect(
      sections.reduce((count, section) => count + section.data.length, 0),
    ).toBe(1_000)
  })
})

function createCategory(
  id: string,
  name: string,
  parentCategoryId?: string,
): Category {
  return {
    id,
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    name,
    icon: "circle",
    color: "#b45309",
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
