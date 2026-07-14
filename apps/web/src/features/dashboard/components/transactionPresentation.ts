import type { PaymentMethod, Transaction } from "@salimon/types"

export function getPaymentLabel(
  transaction: Transaction,
  paymentMethod?: PaymentMethod,
): string | undefined {
  if (paymentMethod?.type === "card") {
    const issuer = paymentMethod.issuer?.replace(/카드$/, "") || "카드"
    const deletedLabel = paymentMethod.isDeleted ? " · 삭제" : ""
    return `${issuer}(${paymentMethod.name})${deletedLabel}`
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

export function getInstallmentLabel(
  transaction: Transaction,
): string | undefined {
  if (transaction.recurringType !== "installment") {
    return undefined
  }

  if (transaction.installmentNumber && transaction.installmentTotal) {
    return `할부 ${transaction.installmentNumber}/${transaction.installmentTotal}회`
  }

  return "할부"
}
