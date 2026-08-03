import { formatKrw, getCategoryLabel } from "@salimon/domain"
import type { Category, Transaction, TransactionSplit } from "@salimon/types"

export type SettlementChart = "bar" | "pie"

export function getSettlementCategoryName(
  categories: Category[],
  transaction: Transaction,
  splits: TransactionSplit[],
) {
  const transactionSplits = splits.filter(
    (split) => split.transactionId === transaction.id,
  )
  if (transactionSplits.length > 0) {
    return transactionSplits
      .map(
        (split) =>
          `${getCategoryLabel(categories, split.categoryId)} ${formatKrw(split.amount)}`,
      )
      .join(" / ")
  }
  return getCategoryLabel(categories, transaction.categoryId)
}

export function getSettlementActorName(
  members: { userId: string; nickname: string }[],
  transaction: Transaction,
) {
  if (!transaction.actorUserId) return "공통"
  return (
    members.find((member) => member.userId === transaction.actorUserId)
      ?.nickname ?? "탈퇴한 멤버"
  )
}
