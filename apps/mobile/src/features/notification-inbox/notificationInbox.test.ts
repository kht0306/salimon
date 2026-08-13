import { describe, expect, it } from "vitest"
import {
  candidateStatusLabel,
  createCandidateFromNotificationRecord,
} from "./notificationInbox"

describe("notification inbox candidate", () => {
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
        sourcePackageName: "com.lotte",
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
})
