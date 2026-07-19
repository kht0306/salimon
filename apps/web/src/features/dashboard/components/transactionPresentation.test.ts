import type { PaymentMethod, Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  getInstallmentLabel,
  getPaymentLabel,
  getPaymentMetadataLabel,
  getPaymentMethodTypeLabel,
  groupTransactionsByActor,
  groupTransactionsByRecurrence,
  groupTransactionsByRegistrant,
  matchesPaymentMethodFilter,
  sortPaymentMethodsForSelection,
} from "./transactionPresentation"

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
  instrumentId: "card-1",
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

describe("getPaymentMethodTypeLabel", () => {
  it("distinguishes credit cards, debit cards, and accounts", () => {
    expect(getPaymentMethodTypeLabel(card)).toBe("신용")
    expect(getPaymentMethodTypeLabel({ ...card, isDebit: true })).toBe("체크")
    expect(getPaymentMethodTypeLabel(account)).toBe("계좌")
  })
})

describe("sortPaymentMethodsForSelection", () => {
  it("orders primary, credit, and debit cards while preserving registration order", () => {
    const paymentMethods = [
      { ...card, id: "debit-1", name: "먼저 등록한 체크", isDebit: true },
      { ...card, id: "credit-1", name: "먼저 등록한 신용" },
      { ...account, id: "account-1" },
      { ...card, id: "credit-2", name: "나중에 등록한 신용" },
      {
        ...card,
        id: "primary",
        name: "주 카드",
        isPrimary: true,
        isDebit: true,
      },
      { ...card, id: "debit-2", name: "나중에 등록한 체크", isDebit: true },
      { ...account, id: "account-2" },
    ]

    expect(
      sortPaymentMethodsForSelection(paymentMethods).map((method) => method.id),
    ).toEqual([
      "primary",
      "credit-1",
      "credit-2",
      "debit-1",
      "debit-2",
      "account-1",
      "account-2",
    ])
    expect(paymentMethods.map((method) => method.id)).toEqual([
      "debit-1",
      "credit-1",
      "account-1",
      "credit-2",
      "primary",
      "debit-2",
      "account-2",
    ])
  })
})

describe("getPaymentMetadataLabel", () => {
  it("shows card type, issuer, and alias while keeping bank and account aliases", () => {
    expect(getPaymentMetadataLabel(transaction, card)).toBe(
      "신용 · 현대카드 · 생활비",
    )
    expect(
      getPaymentMetadataLabel(transaction, { ...card, isDebit: true }),
    ).toBe("체크 · 현대카드 · 생활비")
    expect(getPaymentMetadataLabel(transaction, account)).toBe(
      "국민은행 · 급여 계좌",
    )
  })
})

describe("getPaymentLabel", () => {
  it("formats cash, card, installment and bank account labels", () => {
    expect(getPaymentLabel(transaction)).toBe("현금")
    expect(
      getPaymentLabel({ ...transaction, paymentMethodId: "private-card" }),
    ).toBe("개인 결제수단")
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

describe("groupTransactionsByActor", () => {
  it("groups common transactions first and follows member order", () => {
    const groups = groupTransactionsByActor(
      [
        { ...transaction, id: "member-2", actorUserId: "user-2" },
        { ...transaction, id: "common", actorUserId: undefined },
        { ...transaction, id: "member-1", actorUserId: "user-1" },
      ],
      [
        {
          id: "member-1",
          ledgerId: "ledger-1",
          userId: "user-1",
          nickname: "민호",
          role: "owner",
          status: "active",
          isDefault: true,
          joinedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "member-2",
          ledgerId: "ledger-1",
          userId: "user-2",
          nickname: "수진",
          role: "member",
          status: "active",
          isDefault: false,
          joinedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    )

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "common", label: "공통" },
      { key: "user-1", label: "민호" },
      { key: "user-2", label: "수진" },
    ])
  })
})

describe("groupTransactionsByRegistrant", () => {
  it("groups transactions by the member who registered them", () => {
    const groups = groupTransactionsByRegistrant(
      [
        { ...transaction, id: "registered-2", createdBy: "user-2" },
        { ...transaction, id: "registered-1", createdBy: "user-1" },
      ],
      [
        {
          id: "member-1",
          ledgerId: "ledger-1",
          userId: "user-1",
          nickname: "민호",
          role: "owner",
          status: "active",
          isDefault: true,
          joinedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "member-2",
          ledgerId: "ledger-1",
          userId: "user-2",
          nickname: "수진",
          role: "member",
          status: "active",
          isDefault: false,
          joinedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    )

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "user-1", label: "민호" },
      { key: "user-2", label: "수진" },
    ])
  })
})

describe("groupTransactionsByRecurrence", () => {
  it("places fixed and installment transactions before general transactions", () => {
    const groups = groupTransactionsByRecurrence([
      { ...transaction, id: "general" },
      { ...transaction, id: "installment", recurringType: "installment" },
      { ...transaction, id: "fixed", recurringType: "fixed" },
    ])

    expect(
      groups.map(({ key, label, transactions }) => ({
        key,
        label,
        ids: transactions.map((item) => item.id),
      })),
    ).toEqual([
      {
        key: "recurring",
        label: "반복 거래",
        ids: ["installment", "fixed"],
      },
      { key: "general", label: "일반 거래", ids: ["general"] },
    ])
  })

  it("omits empty recurrence sections", () => {
    expect(groupTransactionsByRecurrence([transaction])).toHaveLength(1)
    expect(groupTransactionsByRecurrence([])).toEqual([])
  })
})

describe("matchesPaymentMethodFilter", () => {
  it("matches multiple payment methods and cash expenses", () => {
    expect(matchesPaymentMethodFilter(transaction, [])).toBe(true)
    expect(
      matchesPaymentMethodFilter({ ...transaction, paymentMethodId: card.id }, [
        card.id,
        account.id,
      ]),
    ).toBe(true)
    expect(matchesPaymentMethodFilter(transaction, ["cash"])).toBe(true)
    expect(
      matchesPaymentMethodFilter({ ...transaction, type: "income" }, ["cash"]),
    ).toBe(false)
  })
})
