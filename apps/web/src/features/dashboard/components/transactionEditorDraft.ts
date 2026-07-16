import { getDateTimeLocalValue } from "@salimon/domain"
import type { Transaction } from "@salimon/types"

export interface TransactionEditorDraft {
  amount: string
  merchantName: string
  memo: string
  type: Transaction["type"]
  status: Transaction["status"]
  categoryId: string
  actorUserId: string
  recurringType: "none" | "fixed" | "installment"
  recurringRuleId?: string
  installmentMonths: string
  installmentAmountType: "monthly" | "principal"
  paymentMethodId: string
  transactionAt: string
}

export function createNewTransactionDraft(input: {
  selectedDate: string
  expenseCategoryId?: string
  actorUserId?: string
  primaryPaymentMethodId?: string
}): TransactionEditorDraft {
  return {
    amount: "",
    merchantName: "",
    memo: "",
    type: "expense",
    status: "confirmed",
    categoryId: input.expenseCategoryId ?? "",
    actorUserId: input.actorUserId ?? "",
    recurringType: "none",
    recurringRuleId: undefined,
    installmentMonths: "2",
    installmentAmountType: "monthly",
    paymentMethodId: input.primaryPaymentMethodId ?? "",
    transactionAt: `${input.selectedDate}T12:00`,
  }
}

export function createCopiedTransactionDraft(input: {
  transaction: Transaction
  fallbackCategoryId?: string
  fallbackActorUserId?: string
  activeCategoryIds: ReadonlySet<string>
  activeMemberIds: ReadonlySet<string>
  activePaymentMethodIds: ReadonlySet<string>
  primaryPaymentMethodId?: string
}): TransactionEditorDraft {
  const { transaction } = input
  const categoryId =
    transaction.categoryId &&
    input.activeCategoryIds.has(transaction.categoryId)
      ? transaction.categoryId
      : (input.fallbackCategoryId ?? "")
  const actorUserId = transaction.actorUserId
    ? input.activeMemberIds.has(transaction.actorUserId)
      ? transaction.actorUserId
      : (input.fallbackActorUserId ?? "")
    : ""
  const paymentMethodId =
    transaction.type === "expense"
      ? transaction.paymentMethodId &&
        input.activePaymentMethodIds.has(transaction.paymentMethodId)
        ? transaction.paymentMethodId
        : (input.primaryPaymentMethodId ?? "")
      : ""

  return {
    amount: String(transaction.amount),
    merchantName: transaction.merchantName ?? "",
    memo: transaction.memo ?? "",
    type: transaction.type,
    status: transaction.status,
    categoryId,
    actorUserId,
    recurringType: "none",
    recurringRuleId: undefined,
    installmentMonths: "2",
    installmentAmountType: "monthly",
    paymentMethodId,
    transactionAt: getDateTimeLocalValue(transaction.transactionAt),
  }
}

export function canCopyTransaction(transaction: Transaction): boolean {
  return !transaction.recurringType
}

export function isInstallmentEditLocked(
  transaction: Pick<Transaction, "recurringType"> | null,
): boolean {
  return transaction?.recurringType === "installment"
}

export function getInstallmentPaymentMethodId(input: {
  currentPaymentMethodId: string
  activeCardIds: ReadonlySet<string>
  primaryCardId?: string
}): string {
  return input.currentPaymentMethodId &&
    input.activeCardIds.has(input.currentPaymentMethodId)
    ? input.currentPaymentMethodId
    : (input.primaryCardId ?? "")
}
