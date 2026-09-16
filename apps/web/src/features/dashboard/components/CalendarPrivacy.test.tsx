import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { Transaction } from "@salimon/types"
import { CalendarGrid } from "./CalendarGrid"
import { TransactionHistoryItem } from "./TransactionHistoryItem"

const store = vi.hoisted(() => ({
  monthlySummaryVisible: true,
  selectedMonth: "2026-09",
  selectedDate: "2026-09-16",
  selectedMonthBudgets: [
    {
      category: { id: "food", name: "식비", color: "#123456" },
      amount: 987654,
      spent: 123456,
    },
  ],
  calendarMonthTransactions: [
    {
      id: "tx",
      transactionAt: "2026-09-16T12:00:00+09:00",
      amount: 123456,
      type: "expense",
      status: "confirmed",
    },
  ],
  currentMembers: [],
  data: {
    categories: [{ id: "food", name: "식비" }],
    paymentMethods: [],
    transactionSplits: [],
  },
}))
vi.mock("../StoreProvider", () => ({ useAppStore: () => store }))

const transaction: Transaction = {
  id: "tx",
  ledgerId: "ledger",
  amount: 123456,
  currency: "KRW",
  type: "expense",
  status: "confirmed",
  sourceType: "manual",
  categoryId: "food",
  transactionAt: "2026-09-16T12:00:00+09:00",
  createdAt: "2026-09-16T12:00:00+09:00",
  updatedAt: "2026-09-16T12:00:00+09:00",
}

describe("calendar amount privacy", () => {
  it.each([true, false, true])(
    "renders amounts only when visible=%s",
    (visible) => {
      store.monthlySummaryVisible = visible
      const markup = renderToStaticMarkup(
        <>
          <CalendarGrid />
          <TransactionHistoryItem
            transaction={transaction}
            isDeletingInstallment={false}
            onCopy={() => undefined}
            onEdit={() => undefined}
            onEndInstallment={() => undefined}
            onOpenInstallmentDelete={() => undefined}
          />
        </>,
      )
      expect(markup.includes("987,654")).toBe(visible)
      expect(markup.includes("123,456")).toBe(visible)
      expect(markup.includes("••••••")).toBe(!visible)
    },
  )
})
