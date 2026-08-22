import type { Category, PaymentMethod } from "@salimon/types"
import { describe, expect, it } from "vitest"
import { createNewMobileTransactionDraft } from "../transactions/transactionDraft"
import { applyReceiptToMobileDraft } from "./receiptDraft"

const categories: Category[] = [
  createCategory("food", "식비"),
  createCategory("other", "기타"),
]
const paymentMethods: PaymentMethod[] = [
  {
    id: "card-1",
    instrumentId: "instrument-1",
    ledgerId: "ledger-1",
    name: "생활 카드",
    type: "card",
    last4: "1234",
    visibility: "private",
    isPrimary: true,
    isActive: true,
    isDeleted: false,
  },
]

describe("mobile receipt draft", () => {
  it("maps parsed fields and marks the draft as receipt AI", () => {
    const draft = createNewMobileTransactionDraft({
      categories,
      paymentMethods,
      selectedDate: "2026-08-22",
      now: new Date("2026-08-22T10:00:00+09:00"),
    })

    expect(
      applyReceiptToMobileDraft({
        categories,
        draft,
        ledgerId: "ledger-1",
        paymentMethods,
        result: {
          amount: 18_900,
          merchantName: "동네 식당",
          transactionAt: "2026-08-21T19:30:00+09:00",
          categoryHint: "식비",
          paymentLast4: "1234",
          confidence: 0.93,
          warnings: [],
          provider: "gemini",
          model: "gemini-test",
          dataTier: "paid",
        },
      }),
    ).toMatchObject({
      amount: "18900",
      categoryId: "food",
      date: "2026-08-21",
      merchantName: "동네 식당",
      parseConfidence: 0.93,
      paymentMethodId: "card-1",
      sourceType: "receipt_ai",
      time: "19:30",
      type: "expense",
    })
  })
})

function createCategory(id: string, name: string): Category {
  return {
    id,
    ledgerId: "ledger-1",
    type: "expense",
    usageTypes: ["expense"],
    name,
    icon: "circle",
    color: "#2d6a4f",
    sortOrder: id === "food" ? 0 : 1,
    isDefault: true,
    isArchived: false,
  }
}
