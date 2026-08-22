import { describe, expect, it } from "vitest"
import { parseReceiptResult } from "./receiptResponse"

describe("mobile receipt client", () => {
  it("accepts a complete receipt response", () => {
    expect(
      parseReceiptResult({
        amount: 12_300,
        merchantName: "동네마트",
        transactionAt: "2026-08-22T19:20:00+09:00",
        categoryHint: "생활비",
        confidence: 0.91,
        warnings: ["카드 번호를 확인해 주세요."],
        provider: "gemini",
        model: "gemini-test",
        dataTier: "free",
      }),
    ).toMatchObject({
      amount: 12_300,
      merchantName: "동네마트",
      confidence: 0.91,
    })
  })

  it("rejects malformed or unsafe responses", () => {
    expect(() =>
      parseReceiptResult({
        amount: 0,
        merchantName: "",
        transactionAt: "not-a-date",
        confidence: 2,
        warnings: [],
        provider: "gemini",
        model: "gemini-test",
        dataTier: "free",
      }),
    ).toThrow("영수증 분석 결과가 올바르지 않습니다.")
  })
})
