import type { Transaction } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  canCopyTransaction,
  createCopiedTransactionDraft,
  createNewTransactionDraft,
  getInstallmentPaymentMethodId,
  isInstallmentEditLocked,
} from "./transactionEditorDraft"

const transaction: Transaction = {
  id: "transaction-1",
  ledgerId: "ledger-1",
  createdBy: "user-2",
  actorUserId: "user-2",
  type: "expense",
  status: "confirmed",
  amount: 12000,
  currency: "KRW",
  transactionAt: "2026-07-14T03:30:00.000Z",
  categoryId: "category-1",
  paymentMethodId: "card-2",
  merchantName: "살림마트",
  memo: "장보기",
  sourceType: "manual",
  createdAt: "2026-07-14T03:31:00.000Z",
  updatedAt: "2026-07-14T03:31:00.000Z",
}

describe("transaction editor drafts", () => {
  it("uses the signed-in user's primary card for a new expense", () => {
    const draft = createNewTransactionDraft({
      selectedDate: "2026-07-14",
      expenseCategoryId: "category-1",
      actorUserId: "user-1",
      primaryPaymentMethodId: "card-1",
    })

    expect(draft.paymentMethodId).toBe("card-1")
    expect(draft.transactionAt).toBe("2026-07-14T12:00")
  })

  it("copies an ordinary transaction as a separate one-time draft", () => {
    const draft = createCopiedTransactionDraft({
      transaction,
      activeCategoryIds: new Set(["category-1"]),
      activeMemberIds: new Set(["user-2"]),
      activePaymentMethodIds: new Set(["card-2"]),
      primaryPaymentMethodId: "card-1",
    })

    expect(draft).toMatchObject({
      amount: "12000",
      merchantName: "살림마트",
      memo: "장보기",
      categoryId: "category-1",
      actorUserId: "user-2",
      paymentMethodId: "card-2",
      recurringType: "none",
      recurringRuleId: undefined,
    })
  })

  it("falls back to active defaults when copied references are unavailable", () => {
    const draft = createCopiedTransactionDraft({
      transaction,
      fallbackCategoryId: "category-fallback",
      fallbackActorUserId: "user-1",
      activeCategoryIds: new Set(),
      activeMemberIds: new Set(),
      activePaymentMethodIds: new Set(),
      primaryPaymentMethodId: "card-1",
    })

    expect(draft.categoryId).toBe("category-fallback")
    expect(draft.actorUserId).toBe("user-1")
    expect(draft.paymentMethodId).toBe("card-1")
  })

  it("allows copy only for non-recurring transactions", () => {
    expect(canCopyTransaction(transaction)).toBe(true)
    expect(canCopyTransaction({ ...transaction, recurringType: "fixed" })).toBe(
      false,
    )
    expect(
      canCopyTransaction({ ...transaction, recurringType: "installment" }),
    ).toBe(false)
  })

  it("locks recurrence, payment, and amount mode for existing installments", () => {
    expect(isInstallmentEditLocked(null)).toBe(false)
    expect(isInstallmentEditLocked(transaction)).toBe(false)
    expect(
      isInstallmentEditLocked({ recurringType: "fixed" }),
    ).toBe(false)
    expect(
      isInstallmentEditLocked({ recurringType: "installment" }),
    ).toBe(true)
  })

  it("keeps an existing card when converting an ordinary transaction", () => {
    expect(
      getInstallmentPaymentMethodId({
        currentPaymentMethodId: "card-2",
        activeCardIds: new Set(["card-1", "card-2"]),
        primaryCardId: "card-1",
      }),
    ).toBe("card-2")
  })

  it("uses the primary card when converting a cash transaction", () => {
    expect(
      getInstallmentPaymentMethodId({
        currentPaymentMethodId: "cash",
        activeCardIds: new Set(["card-1"]),
        primaryCardId: "card-1",
      }),
    ).toBe("card-1")
  })
})
