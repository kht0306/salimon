import type { Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  buildMonthDaySummaries,
  calculateConfirmedTotals,
} from "./dashboardPresentation"

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
