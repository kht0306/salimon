import { describe, expect, it } from "vitest"
import {
  isSupportedCardApprovalText,
  maskSensitiveText,
  parseCardSmsText,
} from "../src"

const kbApproval = [
  "[Web발신] KB국민카드1234",
  "승인",
  "26,700 원(일시불)",
  "테스트몰(간편결제)",
  "고객명 테*트님",
  "승인시각 09/23 18:15",
  "누적 5,460,232원",
].join("\n")
const wooriApproval = [
  "[우리카드 이용 안내]",
  "우리(5678)승인",
  "테*트님",
  "220,000원 일시불",
  "07/20 09:58",
  "(주)테스트 교육",
].join("\n")

describe("KB and Woori approval formats", () => {
  it.each(["multiline", "singleline"])(
    "parses KB %s without choosing customer or cumulative amount",
    (format) => {
      const parsed = parseCardSmsText(
        format === "multiline" ? kbApproval : kbApproval.replaceAll("\n", " "),
        new Date(2026, 8, 23, 18, 16),
      )
      expect(parsed).toMatchObject({
        amount: 26700,
        merchantName: "테스트몰(간편결제)",
        type: "expense",
        cardNotificationEvent: "approval",
      })
      expect(new Date(parsed.transactionAt).getHours()).toBe(18)
      expect(new Date(parsed.transactionAt).getMinutes()).toBe(15)
      expect(parsed.rawTextMasked).not.toContain("1234")
    },
  )

  it.each(["multiline", "singleline"])(
    "parses Woori %s and strips the Kakao template footer",
    (format) => {
      const text = `${wooriApproval}\n채널 추가하고 이 채널의 마케팅 메시지 등을 카카오톡으로 받기\n이용내역 확인하기`
      const parsed = parseCardSmsText(
        format === "multiline" ? text : text.replaceAll("\n", " "),
        new Date(2026, 6, 20, 10),
      )
      expect(parsed).toMatchObject({
        amount: 220000,
        merchantName: "(주)테스트 교육",
        type: "expense",
        cardNotificationEvent: "approval",
      })
      expect(parsed.rawTextMasked).not.toContain("5678")
    },
  )

  it("uses the approval body amount instead of an Alimtalk banner amount", () => {
    const parsed = parseCardSmsText(
      `카드승인금액 999,000원\n${wooriApproval}`,
      new Date(2026, 6, 20),
    )
    expect(parsed.amount).toBe(220000)
  })

  it.each([
    "[Web발신] 취소 [KB국민카드] 1234 테*트님 테스트몰 09/20 이용건 09/22 부분취소(-15,900원)",
    kbApproval.replace("승인\n", "승인취소\n"),
    wooriApproval.replace("승인", "승인 취소"),
    wooriApproval.replace("승인", "승인거절"),
    "테스트님: 10,000원 결제했어요",
    `${kbApproval}\n${kbApproval}`,
  ])("excludes unsupported events and combined transactions", (text) => {
    expect(isSupportedCardApprovalText(text)).toBe(false)
  })

  it.each([
    kbApproval.replace("26,700 원(일시불)", ""),
    kbApproval.replace("테스트몰(간편결제)\n고객명", "테스트몰…\n고객명"),
    wooriApproval.replace("\n(주)테스트 교육", ""),
    kbApproval.replace("09/23 18:15", "02/30 18:15"),
    kbApproval.replace("승인시각 09/23 18:15", ""),
  ])(
    "keeps incomplete approvals below the registration-ready threshold",
    (text) => {
      expect(
        parseCardSmsText(text, new Date(2026, 8, 23)).confidence,
      ).toBeLessThan(0.85)
    },
  )

  it("uses the same approval interpretation regardless of receipt channel", () => {
    const receivedAt = new Date(2026, 8, 23, 18, 16)
    const sms = parseCardSmsText(`KB국민카드\n${kbApproval}`, receivedAt, {
      sourceApp: "com.samsung.android.messaging",
    })
    const chat = parseCardSmsText(
      kbApproval.replaceAll("\n", " "),
      receivedAt,
      { sourceApp: "com.kakao.talk" },
    )
    expect(sms.amount).toBe(chat.amount)
    expect(sms.merchantName).toBe(chat.merchantName)
    expect(sms.transactionAt).toBe(chat.transactionAt)
  })
})

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

  it("parses the Lotte Card Today House approval notification", () => {
    const parsed = parseCardSmsText(
      [
        "오늘의집",
        "59,900원 승인",
        "쇼핑엔 로카(8*3*)",
        "일시불, 08/28 14:15",
        "누적금액 2,710,755원",
      ].join("\n"),
      new Date("2026-08-28T14:16:00+09:00"),
    )

    expect(parsed).toMatchObject({
      amount: 59_900,
      cardNotificationEvent: "approval",
      merchantName: "오늘의집",
      type: "expense",
    })
    expect(parsed.amount).not.toBe(2_710_755)
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
