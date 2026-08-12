import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
} from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  changeMobileTransactionType,
  createEditingMobileTransactionDraft,
  createNewMobileTransactionDraft,
  isGeneralMobileTransaction,
  validateMobileTransactionDraft,
} from "./transactionDraft"

const categories: Category[] = [
  {
    id: "expense-category",
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    name: "식비",
    icon: "utensils",
    color: "#b45309",
    sortOrder: 1,
    isDefault: true,
    isArchived: false,
  },
  {
    id: "income-category",
    ledgerId: "ledger-1",
    type: "income",
    usageTypes: ["income"],
    name: "기타 수입",
    icon: "wallet",
    color: "#2563eb",
    sortOrder: 2,
    isDefault: true,
    isArchived: false,
  },
  {
    id: "saving-category",
    ledgerId: "ledger-1",
    type: "saving",
    usageTypes: ["saving"],
    name: "비상금",
    icon: "piggy-bank",
    color: "#6d28d9",
    sortOrder: 3,
    isDefault: true,
    isArchived: false,
  },
]

const members: LedgerMember[] = [
  {
    id: "member-1",
    ledgerId: "ledger-1",
    userId: "user-1",
    nickname: "살림 가족",
    role: "owner",
    status: "active",
    isDefault: true,
    joinedAt: "2026-08-01T00:00:00.000Z",
  },
]

const paymentMethods: PaymentMethod[] = [
  {
    id: "card-1",
    instrumentId: "instrument-card",
    ledgerId: "ledger-1",
    ownerUserId: "user-1",
    name: "생활비 카드",
    type: "card",
    visibility: "ledger",
    isActive: true,
    isPrimary: true,
  },
  {
    id: "bank-1",
    instrumentId: "instrument-bank",
    ledgerId: "ledger-1",
    ownerUserId: "user-1",
    name: "저축 계좌",
    type: "bank",
    visibility: "ledger",
    isActive: true,
  },
]

describe("mobile transaction draft", () => {
  it("creates an expense draft with the active defaults", () => {
    const draft = createNewMobileTransactionDraft({
      actorUserId: "user-1",
      categories,
      paymentMethods,
      selectedDate: "2026-08-12",
      now: new Date("2026-08-12T20:30:00+09:00"),
    })

    expect(draft).toMatchObject({
      actorUserId: "user-1",
      categoryId: "expense-category",
      date: "2026-08-12",
      paymentMethodId: "card-1",
      time: "20:30",
      type: "expense",
    })
  })

  it("switches category and payment defaults with the transaction type", () => {
    const expenseDraft = createNewMobileTransactionDraft({
      categories,
      paymentMethods,
      selectedDate: "2026-08-12",
    })

    const savingDraft = changeMobileTransactionType(
      expenseDraft,
      "saving",
      categories,
      paymentMethods,
    )
    const incomeDraft = changeMobileTransactionType(
      savingDraft,
      "income",
      categories,
      paymentMethods,
    )

    expect(savingDraft.categoryId).toBe("saving-category")
    expect(savingDraft.paymentMethodId).toBe("bank-1")
    expect(incomeDraft.categoryId).toBe("income-category")
    expect(incomeDraft.paymentMethodId).toBe("")
  })

  it("validates amount, date, category usage, and saving account", () => {
    const draft = createNewMobileTransactionDraft({
      categories,
      paymentMethods,
      selectedDate: "2026-08-12",
    })
    const context = {
      categories,
      ledgerId: "ledger-1",
      members,
      paymentMethods,
    }

    expect(validateMobileTransactionDraft(draft, context)).toEqual({
      valid: false,
      message: "금액을 1원 이상 숫자로 입력해 주세요.",
    })
    expect(
      validateMobileTransactionDraft(
        { ...draft, amount: "10000", date: "2026-02-30" },
        context,
      ),
    ).toEqual({
      valid: false,
      message: "거래 날짜와 시간을 올바른 형식으로 입력해 주세요.",
    })
    expect(
      validateMobileTransactionDraft(
        { ...draft, amount: "10000", categoryId: "income-category" },
        context,
      ),
    ).toEqual({
      valid: false,
      message: "거래 유형에 사용할 수 있는 카테고리를 선택해 주세요.",
    })
    expect(
      validateMobileTransactionDraft(
        {
          ...draft,
          amount: "10000",
          categoryId: "saving-category",
          paymentMethodId: "card-1",
          type: "saving",
        },
        context,
      ),
    ).toEqual({
      valid: false,
      message: "저축 거래에는 계좌를 선택해 주세요.",
    })
  })

  it("normalizes a valid income draft without recurrence fields", () => {
    const result = validateMobileTransactionDraft(
      {
        actorUserId: "user-1",
        amount: "120000",
        categoryId: "income-category",
        date: "2026-08-12",
        merchantName: "  중고 거래  ",
        memo: "  판매 대금  ",
        paymentMethodId: "card-1",
        status: "confirmed",
        tagsInput: "중고, 판매, 중고",
        time: "20:30",
        type: "income",
      },
      {
        categories,
        ledgerId: "ledger-1",
        members,
        paymentMethods,
      },
    )

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.input).toMatchObject({
      actorUserId: "user-1",
      amount: 120000,
      categoryId: "income-category",
      incomeKind: "side_income",
      merchantName: "중고 거래",
      memo: "판매 대금",
      paymentMethodId: undefined,
      tags: ["중고", "판매"],
      type: "income",
    })
    expect(result.input).not.toHaveProperty("recurringType")
  })

  it("preserves an archived category only while editing its existing transaction", () => {
    const archivedCategory = { ...categories[0], isArchived: true }
    const transaction = createTransaction({ categoryId: archivedCategory.id })
    const draft = createEditingMobileTransactionDraft(transaction)
    const result = validateMobileTransactionDraft(draft, {
      categories: [archivedCategory, ...categories.slice(1)],
      editingTransaction: transaction,
      ledgerId: "ledger-1",
      members,
      paymentMethods,
    })

    expect(result.valid).toBe(true)
  })

  it("allows editing only when the transaction has no recurring or split structure", () => {
    const transaction = createTransaction()

    expect(isGeneralMobileTransaction(transaction, 0)).toBe(true)
    expect(
      isGeneralMobileTransaction({ ...transaction, recurringType: "fixed" }, 0),
    ).toBe(false)
    expect(isGeneralMobileTransaction(transaction, 2)).toBe(false)
  })
})

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "transaction-1",
    ledgerId: "ledger-1",
    createdBy: "user-1",
    actorUserId: "user-1",
    type: "expense",
    status: "confirmed",
    amount: 12_000,
    currency: "KRW",
    transactionAt: "2026-08-12T20:30:00+09:00",
    categoryId: "expense-category",
    paymentMethodId: "card-1",
    sourceType: "manual",
    createdAt: "2026-08-12T20:30:00+09:00",
    updatedAt: "2026-08-12T20:30:00+09:00",
    ...overrides,
  }
}
