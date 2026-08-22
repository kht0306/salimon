import { createEmptyFinanceData } from "@salimon/api-client"
import { describe, expect, it } from "vitest"
import {
  createFullBackupJson,
  createLedgerTransactionsCsv,
  parseBackupTransactionsJson,
  safeDataFilename,
} from "./dataExport"

describe("mobile data export", () => {
  it("exports the supported account backup fields", () => {
    const data = createEmptyFinanceData()
    data.profile.nickname = "살림 가족"
    const backup = JSON.parse(
      createFullBackupJson(data, new Date("2026-08-22T00:00:00.000Z")),
    ) as Record<string, unknown>

    expect(backup).toMatchObject({
      schemaVersion: 1,
      service: "Salimon",
      exportedAt: "2026-08-22T00:00:00.000Z",
      profile: { nickname: "살림 가족" },
    })
    expect(parseBackupTransactionsJson(JSON.stringify(backup))).toEqual([])
  })

  it("escapes spreadsheet formulas in CSV exports", () => {
    const data = createEmptyFinanceData()
    data.transactions = [
      {
        id: "transaction-1",
        ledgerId: "ledger-1",
        createdBy: "user-1",
        type: "expense",
        status: "confirmed",
        amount: 1_000,
        transactionAt: "2026-08-22T12:00:00+09:00",
        merchantName: '=HYPERLINK("https://example.com")',
        sourceType: "manual",
        currency: "KRW",
        createdAt: "2026-08-22T12:00:00+09:00",
        updatedAt: "2026-08-22T12:00:00+09:00",
      },
    ]

    expect(createLedgerTransactionsCsv(data, "ledger-1")).toContain(
      "'=HYPERLINK",
    )
    expect(safeDataFilename("우리 집 / 공동")).toBe("우리-집-공동")
  })

  it("rejects JSON without a transaction list", () => {
    expect(() => parseBackupTransactionsJson('{"schemaVersion":1}')).toThrow(
      "거래 목록",
    )
  })
})
