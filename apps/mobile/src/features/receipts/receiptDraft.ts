import {
  findOtherCategory,
  getDateTimeLocalValue,
  isSplitCategory,
} from "@salimon/domain"
import type {
  Category,
  PaymentMethod,
  ReceiptParseResult,
} from "@salimon/types"
import type { MobileTransactionDraft } from "../transactions/transactionDraft"

interface ApplyReceiptDraftInput {
  categories: Category[]
  draft: MobileTransactionDraft
  ledgerId: string
  paymentMethods: PaymentMethod[]
  result: ReceiptParseResult
}

export function applyReceiptToMobileDraft({
  categories,
  draft,
  ledgerId,
  paymentMethods,
  result,
}: ApplyReceiptDraftInput): MobileTransactionDraft {
  const expenseCategories = categories.filter(
    (category) =>
      category.ledgerId === ledgerId &&
      !category.isArchived &&
      !isSplitCategory(category) &&
      category.usageTypes.includes("expense"),
  )
  const hintedCategory = result.categoryHint
    ? expenseCategories.find(
        (category) =>
          category.name.toLocaleLowerCase("ko-KR") ===
          result.categoryHint?.toLocaleLowerCase("ko-KR"),
      )
    : undefined
  const category =
    hintedCategory ?? findOtherCategory(expenseCategories, ledgerId)
  const paymentMethod = result.paymentLast4
    ? paymentMethods.find(
        (method) =>
          method.ledgerId === ledgerId &&
          !method.isDeleted &&
          method.isActive &&
          method.last4 === result.paymentLast4,
      )
    : undefined
  const [date = draft.date, time = draft.time] = getDateTimeLocalValue(
    result.transactionAt,
  ).split("T")

  return {
    ...draft,
    amount: String(result.amount),
    categoryId: category?.id ?? draft.categoryId,
    date,
    merchantName: result.merchantName,
    memo: result.memo ?? "",
    parseConfidence: result.confidence,
    paymentMethodId: paymentMethod?.id ?? draft.paymentMethodId,
    recurringType: "",
    sourceType: "receipt_ai",
    splits: [],
    time: time.slice(0, 5),
    type: "expense",
  }
}
