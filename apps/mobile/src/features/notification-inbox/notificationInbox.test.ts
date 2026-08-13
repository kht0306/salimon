import { describe, expect, it } from "vitest"
import {
  candidateStatusLabel,
  createCandidateFromNotificationRecord,
  SUPPORTED_NOTIFICATION_APPS,
} from "./notificationInbox"

describe("notification inbox candidate", () => {
  it("targets the installed Lotte Card Android package", () => {
    expect(SUPPORTED_NOTIFICATION_APPS).toEqual([
      { name: "롯데카드", packageName: "com.lcacApp" },
    ])
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
