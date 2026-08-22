import type { LedgerMember, Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  buildDashboardListItems,
  buildMonthDaySummaries,
  calculateConfirmedTotals,
} from "./dashboardPresentation"

const members: LedgerMember[] = [
  {
    id: "member-1",
    isDefault: true,
    joinedAt: "2026-08-01T00:00:00.000Z",
    ledgerId: "ledger-1",
    nickname: "본인",
    role: "owner",
    status: "active",
    userId: "user-1",
  },
  {
    id: "member-2",
    isDefault: false,
    joinedAt: "2026-08-01T00:00:00.000Z",
    ledgerId: "ledger-1",
    nickname: "가족",
    role: "member",
    status: "active",
    userId: "user-2",
  },
]

describe("dashboardPresentation", () => {
  it("matches web totals by including only confirmed active transactions", () => {
    const transactions = [
      createTransaction("expense-1", "expense", 12_000, "confirmed", 1),
      createTransaction("income-1", "income", 500_000, "confirmed", 1),
      createTransaction("saving-1", "saving", 100_000, "confirmed", 2),
      createTransaction("excluded-1", "expense", 9_000, "excluded", 2),
      {
        ...createTransaction("deleted-1", "expense", 7_000, "confirmed", 3),
        deletedAt: "2026-08-03T00:00:00.000Z",
      },
    ]

    expect(calculateConfirmedTotals(transactions)).toEqual({
      expense: 12_000,
      income: 500_000,
      saving: 100_000,
    })
  })

  it("builds every date and excludes excluded amounts from day totals", () => {
    const summaries = buildMonthDaySummaries("2026-08", [
      createTransaction("expense-1", "expense", 12_000, "confirmed", 10),
      createTransaction("excluded-1", "expense", 9_000, "excluded", 10),
      createTransaction("income-1", "income", 30_000, "confirmed", 11),
    ])

    expect(summaries).toHaveLength(31)
    expect(summaries[9]).toMatchObject({
      count: 2,
      date: "2026-08-10",
      expense: 12_000,
    })
    expect(summaries[10]).toMatchObject({
      count: 1,
      date: "2026-08-11",
      income: 30_000,
    })
  })

  it("separates recurring and general transactions and keeps collapsed groups hidden", () => {
    const fixed = {
      ...createTransaction("fixed", "expense", 10_000, "confirmed", 10),
      recurringType: "fixed" as const,
    }
    const installment = {
      ...createTransaction("installment", "expense", 20_000, "confirmed", 10),
      recurringType: "installment" as const,
    }
    const general = createTransaction(
      "general",
      "expense",
      30_000,
      "confirmed",
      10,
    )

    const items = buildDashboardListItems(
      [fixed, installment, general],
      members,
      "none",
      new Set(["recurring"]),
    )

    expect(
      items.map((item) =>
        item.kind === "transaction" ? item.transaction.id : item.label,
      ),
    ).toEqual(["반복 거래", "일반 거래", "general"])
    expect(items[0]).toMatchObject({ collapsed: true, count: 2 })
  })

  it("orders actor groups like the web list", () => {
    const common = createTransaction(
      "common",
      "expense",
      10_000,
      "confirmed",
      10,
    )
    const family = {
      ...createTransaction("family", "expense", 20_000, "confirmed", 10),
      actorUserId: "user-2",
    }
    const unknown = {
      ...createTransaction("unknown", "expense", 30_000, "confirmed", 10),
      actorUserId: "removed-user",
    }

    const items = buildDashboardListItems(
      [unknown, family, common],
      members,
      "actor",
      new Set(),
    )

    expect(
      items.filter((item) => item.kind === "member").map((item) => item.label),
    ).toEqual(["공통", "가족", "알 수 없음"])
  })

  it("distinguishes registrants and labels missing members", () => {
    const family = {
      ...createTransaction("family", "expense", 20_000, "confirmed", 10),
      createdBy: "user-2",
    }
    const missing = createTransaction(
      "missing",
      "expense",
      10_000,
      "confirmed",
      10,
    )
    const removed = {
      ...createTransaction("removed", "expense", 30_000, "confirmed", 10),
      createdBy: "removed-user",
    }

    const items = buildDashboardListItems(
      [removed, missing, family],
      members,
      "registrant",
      new Set(),
    )

    expect(
      items.filter((item) => item.kind === "member").map((item) => item.label),
    ).toEqual(["가족", "알 수 없음", "탈퇴한 멤버"])
  })
})

function createTransaction(
  id: string,
  type: Transaction["type"],
  amount: number,
  status: Transaction["status"],
  day: number,
): Transaction {
  const date = `2026-08-${String(day).padStart(2, "0")}T12:00:00+09:00`
  return {
    amount,
    createdAt: date,
    currency: "KRW",
    id,
    ledgerId: "ledger-1",
    sourceType: "manual",
    status,
    transactionAt: date,
    type,
    updatedAt: date,
  }
}
