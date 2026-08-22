import type { FinanceData } from "@salimon/api-client"
import { getCategoryLabel } from "@salimon/domain"
import type { Transaction } from "@salimon/types"

export function createFullBackupJson(
  data: FinanceData,
  exportedAt = new Date(),
): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      service: "Salimon",
      exportedAt: exportedAt.toISOString(),
      profile: data.profile,
      ledgers: data.ledgers,
      members: data.members,
      categories: data.categories,
      categoryBudgets: data.categoryBudgets,
      monthNotes: data.monthNotes,
      recurringRules: data.recurringRules,
      paymentMethods: data.paymentMethods,
      transactions: data.transactions,
      transactionSplits: data.transactionSplits,
    },
    null,
    2,
  )
}

export function createLedgerTransactionsCsv(
  data: FinanceData,
  ledgerId: string,
): string {
  const header = [
    "거래일시",
    "상태",
    "유형",
    "금액",
    "카테고리",
    "가맹점/내용",
    "메모",
    "태그",
    "행위자",
  ]
  const rows = data.transactions
    .filter(
      (transaction) =>
        transaction.ledgerId === ledgerId && !transaction.deletedAt,
    )
    .map((transaction) => [
      transaction.transactionAt,
      transaction.status === "confirmed" ? "정산 포함" : "정산 제외",
      transaction.type === "expense"
        ? "지출"
        : transaction.type === "income"
          ? "수입"
          : "저축",
      transaction.amount,
      transactionCategoryLabel(data, transaction),
      transaction.merchantName ?? "",
      transaction.memo ?? "",
      (transaction.tags ?? []).join(", "),
      data.members.find(
        (member) =>
          member.ledgerId === ledgerId &&
          member.userId === transaction.actorUserId,
      )?.nickname ?? (transaction.actorUserId ? "탈퇴한 멤버" : "공통"),
    ])
  return (
    "\ufeff" +
    [header, ...rows]
      .map((row) => row.map((cell) => csvCell(String(cell))).join(","))
      .join("\n")
  )
}

export function parseBackupTransactionsJson(content: string): unknown[] {
  const parsed: unknown = JSON.parse(content)
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("transactions" in parsed) ||
    !Array.isArray(parsed.transactions)
  ) {
    throw new Error("살림온 백업 파일의 거래 목록을 찾지 못했습니다.")
  }
  return parsed.transactions
}

export function safeDataFilename(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "ledger"
}

function csvCell(value: string): string {
  return '"' + spreadsheetSafeText(value).replaceAll('"', '""') + '"'
}

function spreadsheetSafeText(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? "'" + value : value
}

function transactionCategoryLabel(
  data: FinanceData,
  transaction: Transaction,
): string {
  const splits = data.transactionSplits.filter(
    (split) => split.transactionId === transaction.id,
  )
  return splits.length > 0
    ? splits
        .map(
          (split) =>
            getCategoryLabel(data.categories, split.categoryId) +
            " " +
            String(split.amount) +
            "원",
        )
        .join(" / ")
    : getCategoryLabel(data.categories, transaction.categoryId)
}
