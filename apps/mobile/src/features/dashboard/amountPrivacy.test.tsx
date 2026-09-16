import { describe, expect, it, vi } from "vitest"
import { BudgetOverview } from "./BudgetOverview"
import { DateSummaryStrip } from "./DateSummaryStrip"
import { TransactionRow } from "./TransactionRow"

vi.mock("@emotion/native", () => ({
  default: new Proxy(() => () => "div", { get: () => () => "div" }),
}))
vi.mock("../../components/AppText", () => ({ AppText: "span" }))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => [initial, () => undefined],
}))

const category = {
  id: "food",
  ledgerId: "ledger",
  name: "식비",
  type: "expense" as const,
  color: "#000000",
  icon: "food",
  sortOrder: 0,
  usageTypes: ["expense" as const],
  isDefault: false,
  isArchived: false,
}

describe("dashboard amount privacy", () => {
  it.each([true, false, true])(
    "renders budget, day, and transaction amounts only when visible=%s",
    (amountsVisible) => {
      const markup = JSON.stringify([
        BudgetOverview({
          amountsVisible,
          budgets: [{ category, amount: 987654, spent: 123456 }],
        }),
        DateSummaryStrip({
          amountsVisible,
          days: [
            {
              date: "2026-09-16",
              dayOfMonth: 16,
              count: 1,
              expense: 123456,
              income: 234567,
              saving: 345678,
            },
          ],
          selectedDate: "2026-09-16",
          selectedMonth: "2026-09",
          onSelect: () => undefined,
        }),
        TransactionRow({
          amountsVisible,
          categories: [category],
          members: [],
          splitCount: 0,
          transaction: {
            id: "tx",
            ledgerId: "ledger",
            type: "expense",
            status: "confirmed",
            amount: 123456,
            categoryId: "food",
            transactionAt: "2026-09-16T12:00:00+09:00",
            createdAt: "2026-09-16T12:00:00+09:00",
            updatedAt: "2026-09-16T12:00:00+09:00",
            createdBy: "user",
            sourceType: "manual",
            currency: "KRW",
          },
          onPress: () => undefined,
        }),
      ])
      for (const amount of ["987,654", "123,456", "234,567", "345,678"]) {
        expect(markup.includes(amount)).toBe(amountsVisible)
      }
      expect(markup.includes('"now":123456')).toBe(amountsVisible)
      expect(markup.includes("••••••")).toBe(!amountsVisible)
    },
  )
})
