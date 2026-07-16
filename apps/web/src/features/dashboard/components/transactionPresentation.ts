import type { LedgerMember, PaymentMethod, Transaction } from "@salimon/types"

export interface TransactionActorGroup {
  key: string
  label: string
  transactions: Transaction[]
}

export function groupTransactionsByActor(
  transactions: Transaction[],
  members: LedgerMember[],
): TransactionActorGroup[] {
  const grouped = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const key = transaction.actorUserId ?? "common"
    grouped.set(key, [...(grouped.get(key) ?? []), transaction])
  }

  const orderedKeys = [
    "common",
    ...members.map((member) => member.userId),
    ...grouped.keys(),
  ].filter(
    (key, index, keys) => keys.indexOf(key) === index && grouped.has(key),
  )

  return orderedKeys.map((key) => ({
    key,
    label:
      key === "common"
        ? "공통"
        : (members.find((member) => member.userId === key)?.nickname ??
          "알 수 없음"),
    transactions: grouped.get(key) ?? [],
  }))
}

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

  if (transaction.paymentMethodId) {
    return "개인 결제수단"
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

export function matchesPaymentMethodFilter(
  transaction: Transaction,
  selectedPaymentMethodIds: string[],
): boolean {
  if (selectedPaymentMethodIds.length === 0) return true

  const paymentMethodId =
    transaction.paymentMethodId ??
    (transaction.type === "expense" ? "cash" : undefined)
  return Boolean(
    paymentMethodId && selectedPaymentMethodIds.includes(paymentMethodId),
  )
}
