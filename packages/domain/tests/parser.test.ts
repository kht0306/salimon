import { describe, expect, it } from "vitest"
import { maskSensitiveText, parseCardSmsText } from "../src"

describe("parseCardSmsText", () => {
  it("parses amount, date, merchant and expense type", () => {
    const parsed = parseCardSmsText(
      "[카드사] 06/28 12:34 스타벅스 5,800원 승인",
      new Date("2026-06-28T01:00:00.000Z"),
    )

    expect(parsed.amount).toBe(5800)
    expect(parsed.type).toBe("expense")
    expect(parsed.merchantName).toBe("스타벅스")
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it("recognizes refunds as income candidates", () => {
    const parsed = parseCardSmsText(
      "현대카드 환급 23,400원 쿠팡",
      new Date("2026-06-28T01:00:00.000Z"),
    )

    expect(parsed.amount).toBe(23400)
    expect(parsed.type).toBe("income")
  })

  it("treats account transfers as expense candidates", () => {
    const parsed = parseCardSmsText(
      "국민은행 이체 30,000원 관리비",
      new Date("2026-06-28T01:00:00.000Z"),
    )

    expect(parsed.type).toBe("expense")
  })

  it("parses a multiline Lotte Card notification without using the cumulative amount", () => {
    const parsed = parseCardSmsText(
      [
        "테스트주유소",
        "45,000원 승인",
        "쇼핑엔 로카(8*3*)",
        "일시불, 08/13 14:00",
        "누적금액 3,295,290원",
      ].join("\n"),
      new Date("2026-08-13T14:01:00+09:00"),
    )

    expect(parsed.amount).toBe(45_000)
    expect(parsed.merchantName).toBe("테스트주유소")
    const transactionAt = new Date(parsed.transactionAt)
    expect([
      transactionAt.getMonth() + 1,
      transactionAt.getDate(),
      transactionAt.getHours(),
      transactionAt.getMinutes(),
    ]).toEqual([8, 13, 14, 0])
    expect(parsed.rawTextMasked).toContain("쇼핑엔 로카****")
    expect(parsed.rawTextMasked).not.toContain("(8*3*)")
  })

  it("preserves a foreign approval amount and never substitutes the cumulative KRW amount", () => {
    const parsed = parseCardSmsText(
      [
        "ALIEXPRESS",
        "USD 7.24 해외승인",
        "쇼핑엔 로카(8*3*)",
        "일시불, 08/15 21:23",
        "누적금액 3,357,207원",
      ].join("\n"),
      new Date("2026-08-15T21:24:00+09:00"),
    )

    expect(parsed).toMatchObject({
      amount: 0,
      cardNotificationEvent: "approval",
      currency: "KRW",
      merchantName: "ALIEXPRESS",
      originalCurrencyAmount: {
        amount: 7.24,
        currencyCode: "USD",
      },
      type: "expense",
    })
    expect(parsed.amount).not.toBe(3_357_207)
    const transactionAt = new Date(parsed.transactionAt)
    expect([
      transactionAt.getMonth() + 1,
      transactionAt.getDate(),
      transactionAt.getHours(),
      transactionAt.getMinutes(),
    ]).toEqual([8, 15, 21, 23])
  })

  it("does not parse a foreign decimal amount as the transaction date", () => {
    const parsed = parseCardSmsText(
      [
        "GOOGLE SERVICES",
        "USD 25.00 해외승인",
        "쇼핑엔 로카(8*3*)",
        "일시불, 08/22 22:04",
        "누적금액 3,694,802원",
      ].join("\n"),
      new Date("2026-08-22T22:04:00+09:00"),
    )

    const transactionAt = new Date(parsed.transactionAt)
    expect([
      transactionAt.getFullYear(),
      transactionAt.getMonth() + 1,
      transactionAt.getDate(),
      transactionAt.getHours(),
      transactionAt.getMinutes(),
    ]).toEqual([2026, 8, 22, 22, 4])
  })

  it("marks an approval cancellation separately from its income transaction type", () => {
    const parsed = parseCardSmsText(
      [
        "(주)소모 뉴평내셀프주유소",
        "10,000원 승인취소",
        "쇼핑엔 로카(8*3*)",
        "일시불, 08/14 19:26",
        "누적금액 3,308,688원",
      ].join("\n"),
      new Date("2026-08-14T19:27:00+09:00"),
    )

    expect(parsed).toMatchObject({
      amount: 10_000,
      cardNotificationEvent: "approval_cancellation",
      merchantName: "(주)소모 뉴평내셀프주유소",
      type: "income",
    })
    expect(parsed.amount).not.toBe(3_308_688)
  })
})

describe("maskSensitiveText", () => {
  it("masks account and card-like numbers", () => {
    expect(
      maskSensitiveText("카드 1234567812345678 승인번호 998877"),
    ).toContain("카드 ****")
    expect(maskSensitiveText("010-1234-5678")).toBe("****")
    expect(maskSensitiveText("쇼핑엔 로카(8*3*)")).toBe("쇼핑엔 로카****")
    expect(maskSensitiveText("승인 12000원")).toBe("승인 12000원")
  })
})
