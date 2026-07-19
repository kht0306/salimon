import { describe, expect, it } from "vitest"
import { matchesImageSignature, normalizeReceiptResult } from "./route"

describe("receipt parser safeguards", () => {
  it("accepts only matching image signatures", () => {
    expect(
      matchesImageSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        "image/jpeg",
      ),
    ).toBe(true)
    expect(
      matchesImageSignature(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true)
    expect(
      matchesImageSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        "image/png",
      ),
    ).toBe(false)
  })

  it("normalizes bounded draft data", () => {
    const result = normalizeReceiptResult(
      {
        amount: 12_345.4,
        merchantName: `  ${"가".repeat(120)}  `,
        transactionAt: "2026-07-19T12:34:00+09:00",
        paymentLast4: "1234",
        confidence: 2,
        warnings: Array.from({ length: 7 }, (_, index) => `경고 ${index}`),
      },
      "test-model",
      "free",
    )

    expect(result.amount).toBe(12_345)
    expect(result.merchantName).toHaveLength(100)
    expect(result.paymentLast4).toBe("1234")
    expect(result.confidence).toBe(1)
    expect(result.warnings).toHaveLength(5)
  })

  it("rejects an invalid amount or timestamp", () => {
    expect(() =>
      normalizeReceiptResult(
        {
          amount: 0,
          merchantName: "상점",
          transactionAt: "not-a-date",
        },
        "test-model",
        "paid",
      ),
    ).toThrow("invalid receipt result")
  })
})
