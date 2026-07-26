import type { Transaction } from "@salimon/types"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { InstallmentDeleteDialog } from "./InstallmentDeleteDialog"

const transactions: Transaction[] = [1, 2, 3].map((installmentNumber) => ({
  id: `transaction-${installmentNumber}`,
  ledgerId: "ledger-1",
  recurringRuleId: "rule-1",
  recurringType: "installment",
  installmentNumber,
  installmentTotal: 3,
  type: "expense",
  status: "confirmed",
  amount: 100000,
  currency: "KRW",
  transactionAt: `2026-0${installmentNumber + 6}-24T07:30:00.000Z`,
  merchantName: "노트북",
  sourceType: "manual",
  createdAt: "2026-07-24T07:30:00.000Z",
  updatedAt: "2026-07-24T07:30:00.000Z",
}))

describe("InstallmentDeleteDialog", () => {
  it("shows single, future, remaining, and full-series scopes", () => {
    const html = renderToStaticMarkup(
      <InstallmentDeleteDialog
        transaction={transactions[1]!}
        seriesTransactions={transactions}
        busy={false}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain("이 회차만 삭제")
    expect(html).toContain("다음 회차부터 종료")
    expect(html).toContain("이 회차부터 종료")
    expect(html).toContain("할부 전체 삭제")
    expect(html).toContain("₩200,000")
    expect(html).toContain("₩300,000")
  })
})
