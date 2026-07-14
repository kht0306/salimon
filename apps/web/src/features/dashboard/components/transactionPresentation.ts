import type { PaymentMethod, Transaction } from "@salimon/types"

export function getPaymentLabel(
  transaction: Transaction,
  paymentMethod?: PaymentMethod,
): string | undefined {
  if (paymentMethod?.type === "card") {
    const prefix = transaction.recurringType === "installment" ? "할부" : "카드"
    return `${prefix}[${paymentMethod.name}${paymentMethod.isDeleted ? " · 삭제" : ""}]`
  }

  if (paymentMethod?.type === "bank") {
    return [
      "계좌",
      paymentMethod.issuer,
      `${paymentMethod.name}${paymentMethod.isDeleted ? " · 삭제" : ""}`,
    ]
      .filter(Boolean)
      .join(" · ")
  }

  return transaction.type === "expense" ? "현금" : undefined
}
