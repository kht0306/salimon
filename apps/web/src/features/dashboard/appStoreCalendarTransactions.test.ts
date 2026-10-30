import { AppStore } from "@salimon/store"
import type { Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"

const transaction: Transaction = {
  id: "general-expense",
  ledgerId: "ledger",
  createdBy: "user-1",
  type: "expense",
  status: "confirmed",
  amount: 12000,
  currency: "KRW",
  sourceType: "manual",
  transactionAt: "2026-10-15T12:00:00+09:00",
  createdAt: "2026-10-15T12:00:00+09:00",
  updatedAt: "2026-10-15T12:00:00+09:00",
}

function createStore(): AppStore {
  const store = new AppStore()
  store.selectedLedgerId = "ledger"
  store.selectedMonth = "2026-10"
  store.selectedDate = "2026-10-15"
  store.data.transactions = [
    transaction,
    {
      ...transaction,
      id: "fixed-expense",
      amount: 30000,
      recurringType: "fixed",
    },
    {
      ...transaction,
      id: "installment",
      amount: 20000,
      recurringType: "installment",
      createdBy: "user-2",
    },
    {
      ...transaction,
      id: "salary",
      type: "income",
      amount: 500000,
      recurringType: "fixed",
    },
    {
      ...transaction,
      id: "saving",
      type: "saving",
      amount: 50000,
      recurringType: "fixed",
    },
    {
      ...transaction,
      id: "excluded",
      amount: 999999,
      recurringType: "fixed",
      status: "excluded",
    },
    {
      ...transaction,
      id: "deleted",
      recurringType: "fixed",
      deletedAt: transaction.updatedAt,
    },
    {
      ...transaction,
      id: "other-ledger",
      ledgerId: "other-ledger",
      recurringType: "fixed",
    },
    {
      ...transaction,
      id: "other-month",
      transactionAt: "2026-09-15T12:00:00+09:00",
      recurringType: "fixed",
    },
    {
      ...transaction,
      id: "other-date",
      amount: 1000,
      recurringType: "fixed",
      transactionAt: "2026-10-16T12:00:00+09:00",
    },
  ]
  return store
}

describe("calendar transaction filters", () => {
  it("filters month, selected date, and all three totals together without altering source transactions", () => {
    const store = createStore()
    expect(store.calendarRecurrenceFilter).toBe("all")
    expect(store.calendarMonthTotals).toEqual({
      expense: 63000,
      income: 500000,
      saving: 50000,
    })

    store.setCalendarRecurrenceFilter("recurring")
    expect(
      store.calendarSelectedDateTransactions.map((item) => item.id),
    ).toEqual(["fixed-expense", "installment", "salary", "saving", "excluded"])
    expect(store.calendarMonthTotals).toEqual({
      expense: 51000,
      income: 500000,
      saving: 50000,
    })

    store.setCalendarRecurrenceFilter("general")
    expect(
      store.calendarSelectedDateTransactions.map((item) => item.id),
    ).toEqual(["general-expense"])
    expect(store.calendarMonthTotals).toEqual({
      expense: 12000,
      income: 0,
      saving: 0,
    })
    expect(store.monthExpenseTotal).toBe(63000)
    expect(store.data.transactions).toHaveLength(10)

    store.setCalendarRecurrenceFilter("all")
    expect(store.calendarSelectedDateTransactions).toHaveLength(6)
    expect(store.calendarMonthTotals.expense).toBe(63000)
  })

  it("intersects recurrence and registrant filters and returns zero totals for an empty result", () => {
    const store = createStore()
    store.setCalendarRecurrenceFilter("recurring")
    store.setCalendarRegistrant("user-2")
    expect(
      store.calendarSelectedDateTransactions.map((item) => item.id),
    ).toEqual(["installment"])
    expect(store.calendarMonthTotals).toEqual({
      expense: 20000,
      income: 0,
      saving: 0,
    })

    store.setCalendarRecurrenceFilter("general")
    expect(store.calendarSelectedDateTransactions).toEqual([])
    expect(store.calendarMonthTotals).toEqual({
      expense: 0,
      income: 0,
      saving: 0,
    })
  })
})
