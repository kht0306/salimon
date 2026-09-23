import { describe, expect, it } from "vitest"
import {
  candidateAmountLabel,
  candidateStatusLabel,
  cardNotificationEventLabel,
  createCandidateFromNotificationRecord,
  isSupportedNotificationRecord,
  SUPPORTED_NOTIFICATION_APPS,
} from "./notificationInbox"

describe("notification inbox candidate", () => {
  it("offers card, SMS and Kakao notification sources", () => {
    expect(SUPPORTED_NOTIFICATION_APPS.map((app) => app.packageName)).toEqual([
      "com.lcacApp",
      "com.samsung.android.messaging",
      "com.google.android.apps.messaging",
      "com.kakao.talk",
    ])
  })

  it("turns a Woori Kakao approval into the same editable expense candidate", () => {
    const record = {
      capturedAt: new Date(2026, 6, 20, 10).getTime(),
      receivedAt: new Date(2026, 6, 20, 9, 58).getTime(),
      expandedText:
        "[우리카드 이용 안내]\n우리(5678)승인\n테*트님\n220,000원 일시불\n07/20 09:58\n(주)테스트 교육",
      id: "woori-message",
      sourcePackageName: "com.kakao.talk",
      text: "새 메시지",
      title: "우리카드",
    }
    expect(isSupportedNotificationRecord(record)).toBe(true)
    const candidate = createCandidateFromNotificationRecord({
      record,
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })
    expect(candidate.parsed).toMatchObject({
      amount: 220000,
      merchantName: "(주)테스트 교육",
      type: "expense",
    })
    expect(candidate.status).toBe("notified")
    expect(isSupportedNotificationRecord({ ...record, title: "친구" })).toBe(
      false,
    )
    expect(
      isSupportedNotificationRecord({
        ...record,
        expandedText: record.expandedText.replace("승인", "승인취소"),
      }),
    ).toBe(false)
    expect(
      isSupportedNotificationRecord({
        ...record,
        expandedText: "10,000원 결제했어요",
      }),
    ).toBe(false)
  })

  it("keeps only masked text after parsing a native record", () => {
    const candidate = createCandidateFromNotificationRecord({
      record: {
        capturedAt: 1_786_600_000_000,
        expandedText: [
          "45,000원 승인",
          "쇼핑엔 로카(8*3*)",
          "일시불, 08/13 14:00",
          "누적금액 3,295,290원",
        ].join("\n"),
        id: "a".repeat(64),
        receivedAt: new Date("2026-08-13T14:01:00+09:00").getTime(),
        sourcePackageName: "com.lcacApp",
        text: "45,000원 승인",
        title: "테스트주유소",
      },
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })

    expect(candidate.id).toBe("a".repeat(64))
    expect(candidate.parsed.amount).toBe(45_000)
    expect(candidate.parsed.merchantName).toBe("테스트주유소")
    expect(candidate.maskedMessage).not.toContain("(8*3*)")
    expect(candidate).not.toHaveProperty("rawMessage")
    expect(candidateStatusLabel(candidate)).toBe("등록 가능")
    expect(cardNotificationEventLabel(candidate)).toBe("정상 승인")
    expect(candidateAmountLabel(candidate)).toBe("₩45,000")
  })

  it("creates a candidate from the Today House Lotte Card notification", () => {
    const candidate = createCandidateFromNotificationRecord({
      record: {
        capturedAt: new Date("2026-08-28T14:16:00+09:00").getTime(),
        expandedText: [
          "59,900원 승인",
          "쇼핑엔 로카(8*3*)",
          "일시불, 08/28 14:15",
          "누적금액 2,710,755원",
        ].join("\n"),
        id: "t".repeat(64),
        receivedAt: new Date("2026-08-28T14:16:00+09:00").getTime(),
        sourcePackageName: "com.lcacApp",
        text: "59,900원 승인",
        title: "오늘의집",
      },
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })

    expect(candidate.status).toBe("notified")
    expect(candidate.parsed).toMatchObject({
      amount: 59_900,
      merchantName: "오늘의집",
    })
  })

  it("shows foreign approvals without using the cumulative KRW amount", () => {
    const candidate = createCandidateFromNotificationRecord({
      record: {
        capturedAt: 1_786_600_000_000,
        expandedText: [
          "USD 7.24 해외승인",
          "쇼핑엔 로카(8*3*)",
          "일시불, 08/15 21:23",
          "누적금액 3,357,207원",
        ].join("\n"),
        id: "f".repeat(64),
        receivedAt: new Date("2026-08-15T21:24:00+09:00").getTime(),
        sourcePackageName: "com.lcacApp",
        text: "USD 7.24 해외승인",
        title: "ALIEXPRESS",
      },
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })

    expect(candidate.status).toBe("needs_review")
    expect(candidateStatusLabel(candidate)).toBe("원화 금액 필요")
    expect(cardNotificationEventLabel(candidate)).toBe("해외 승인")
    expect(candidateAmountLabel(candidate)).toBe("USD 7.24")
    expect(candidate.parsed.amount).toBe(0)
  })

  it("labels approval cancellations separately", () => {
    const candidate = createCandidateFromNotificationRecord({
      record: {
        capturedAt: 1_786_600_000_000,
        expandedText: "10,000원 승인취소\n일시불, 08/14 19:26",
        id: "c".repeat(64),
        receivedAt: new Date("2026-08-14T19:27:00+09:00").getTime(),
        sourcePackageName: "com.lcacApp",
        text: "10,000원 승인취소",
        title: "(주)소모 뉴평내셀프주유소",
      },
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })

    expect(candidate.parsed.type).toBe("income")
    expect(cardNotificationEventLabel(candidate)).toBe("승인취소")
  })

  it("restores an encrypted pending registration draft", () => {
    const candidate = createCandidateFromNotificationRecord({
      record: {
        capturedAt: 1_786_600_000_000,
        expandedText: "45,000원 승인",
        id: "b".repeat(64),
        receivedAt: new Date("2026-08-13T14:01:00+09:00").getTime(),
        registrationState: {
          amount: 43_000,
          categoryId: "category-1",
          merchantName: "수정한 상점",
          paymentMethodId: "card-1",
          targetLedgerId: "ledger-2",
          transactionAt: "2026-08-13T15:10:00+09:00",
          updatedAt: new Date("2026-08-13T15:11:00+09:00").getTime(),
        },
        sourcePackageName: "com.lcacApp",
        text: "45,000원 승인",
        title: "테스트상점",
      },
      targetLedgerId: "ledger-1",
      userId: "user-1",
    })

    expect(candidate.status).toBe("registration_pending")
    expect(candidate.targetLedgerId).toBe("ledger-2")
    expect(candidate.parsed.amount).toBe(43_000)
    expect(candidate.parsed.merchantName).toBe("수정한 상점")
    expect(candidate.registrationState?.categoryId).toBe("category-1")
    expect(candidateStatusLabel(candidate)).toBe("등록 대기")
  })
})
