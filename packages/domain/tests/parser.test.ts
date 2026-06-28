import { describe, expect, it } from "vitest"
import { maskSensitiveText, parseCardSmsText } from "../src"

describe("parseCardSmsText", () => {
  it("parses amount, date, merchant and expense type", () => {
    const parsed = parseCardSmsText("[카드사] 06/28 12:34 스타벅스 5,800원 승인", new Date("2026-06-28T01:00:00.000Z"))

    expect(parsed.amount).toBe(5800)
    expect(parsed.type).toBe("expense")
    expect(parsed.merchantName).toBe("스타벅스")
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it("recognizes refunds as income candidates", () => {
    const parsed = parseCardSmsText("현대카드 환급 23,400원 쿠팡", new Date("2026-06-28T01:00:00.000Z"))

    expect(parsed.amount).toBe(23400)
    expect(parsed.type).toBe("income")
  })
})

describe("maskSensitiveText", () => {
  it("masks account and card-like numbers", () => {
    expect(maskSensitiveText("카드 1234567812345678 승인번호 998877")).toContain("카드 ****")
    expect(maskSensitiveText("010-1234-5678")).toBe("****")
  })
})
