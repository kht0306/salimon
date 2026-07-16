import type { PaymentMethod, Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import { getInstallmentLabel, getPaymentLabel } from "./transactionPresentation"

const transaction: Transaction = {
  id: "transaction-1",
  ledgerId: "ledger-1",
  createdBy: "user-1",
  type: "expense",
  status: "confirmed",
  amount: 12000,
  currency: "KRW",
  transactionAt: "2026-07-14T03:30:00.000Z",
  sourceType: "manual",
  createdAt: "2026-07-14T03:31:00.000Z",
  updatedAt: "2026-07-14T03:31:00.000Z",
}

const card: PaymentMethod = {
  id: "card-1",
  ledgerId: "ledger-1",
  ownerUserId: "user-1",
  name: "생활비",
  type: "card",
  issuer: "현대카드",
  visibility: "ledger",
  isActive: true,
}

const account: PaymentMethod = {
  ...card,
  id: "account-1",
  name: "급여 계좌",
  type: "bank",
  issuer: "국민은행",
}

describe("getPaymentLabel", () => {
  it("formats cash, card, installment and bank account labels", () => {
    expect(getPaymentLabel(transaction)).toBe("현금")
    expect(getPaymentLabel(transaction, card)).toBe("현대(생활비)")
    expect(
      getPaymentLabel({ ...transaction, recurringType: "installment" }, card),
    ).toBe("현대(생활비)")
    expect(getPaymentLabel(transaction, account)).toBe(
      "계좌 · 국민은행 · 급여 계좌",
    )
  })

  it("does not invent a payment method for non-expense transactions", () => {
    expect(getPaymentLabel({ ...transaction, type: "income" })).toBeUndefined()
  })

  it("shows the selected account for a saving transaction", () => {
    expect(getPaymentLabel({ ...transaction, type: "saving" }, account)).toBe(
      "계좌 · 국민은행 · 급여 계좌",
    )
  })

  it("formats installment progress as a separate label", () => {
    expect(
      getInstallmentLabel({
        ...transaction,
        recurringType: "installment",
        installmentNumber: 2,
        installmentTotal: 6,
      }),
    ).toBe("할부 2/6회")
    expect(getInstallmentLabel(transaction)).toBeUndefined()
  })
})
