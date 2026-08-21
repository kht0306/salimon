import type { LocalSmsCandidate } from "@salimon/types"
import { describe, expect, it } from "vitest"
import {
  createCandidateRegistrationDraft,
  isRetryableCandidateRegistrationError,
  validateCandidateRegistrationDraft,
  type CandidateRegistrationContext,
} from "./candidateRegistration"

const candidate: LocalSmsCandidate = {
  firstDetectedAt: "2026-08-13T05:00:00.000Z",
  id: "a".repeat(64),
  maskedMessage: "45,000원 승인",
  parsed: {
    amount: 45_000,
    confidence: 0.94,
    currency: "KRW",
    merchantName: "테스트주유소",
    normalizedHash: "hash-1",
    transactionAt: "2026-08-13T14:00:00+09:00",
    type: "expense",
  },
  promptCount: 0,
  reviewDeadlineAt: "2026-08-20T05:00:00.000Z",
  sourceApp: "com.lcacApp",
  sourceHash: "hash-1",
  status: "notified",
  targetLedgerId: "ledger-1",
  userId: "user-1",
}

const context: CandidateRegistrationContext = {
  authUserId: "user-1",
  canWriteData: true,
  categories: [
    {
      color: "#000000",
      icon: "food",
      id: "category-1",
      isArchived: false,
      isDefault: true,
      ledgerId: "ledger-1",
      name: "식비",
      sortOrder: 1,
      type: "expense",
      usageTypes: ["expense"],
    },
  ],
  ledgers: [
    {
      currency: "KRW",
      id: "ledger-1",
      name: "우리집",
      ownerId: "user-1",
      role: "owner",
      type: "personal",
    },
  ],
  members: [
    {
      id: "member-1",
      isDefault: true,
      joinedAt: "2026-08-01T00:00:00.000Z",
      ledgerId: "ledger-1",
      nickname: "테스트 사용자",
      role: "owner",
      status: "active",
      userId: "user-1",
    },
  ],
  paymentMethods: [],
}

describe("candidate registration", () => {
  it("creates an editable draft and a notification transaction input", () => {
    const draft = createCandidateRegistrationDraft(candidate, context)
    const validation = validateCandidateRegistrationDraft(
      draft,
      candidate,
      context,
      new Date("2026-08-13T06:00:00.000Z"),
    )

    expect(draft).toMatchObject({
      amount: "45000",
      categoryId: "category-1",
      ledgerId: "ledger-1",
      merchantName: "테스트주유소",
    })
    expect(validation).toEqual({
      valid: true,
      value: {
        input: expect.objectContaining({
          actorUserId: "user-1",
          amount: 45_000,
          sourceApp: "com.lcacApp",
          sourceHash: "hash-1",
          sourceType: "android_sms_notification",
        }),
        registrationState: expect.objectContaining({
          amount: 45_000,
          categoryId: "category-1",
          targetLedgerId: "ledger-1",
        }),
      },
    })
  })

  it("rejects expired candidates and viewer ledgers", () => {
    const draft = createCandidateRegistrationDraft(candidate, context)

    expect(
      validateCandidateRegistrationDraft(
        draft,
        candidate,
        context,
        new Date("2026-08-21T00:00:00.000Z"),
      ),
    ).toEqual({
      valid: false,
      message: "7일 보관 기간이 지나 자동 삭제된 후보입니다.",
    })
    expect(
      validateCandidateRegistrationDraft(
        draft,
        candidate,
        {
          ...context,
          ledgers: [{ ...context.ledgers[0]!, role: "viewer" }],
        },
        new Date("2026-08-13T06:00:00.000Z"),
      ),
    ).toEqual({
      valid: false,
      message: "거래를 등록할 권한이 있는 가계부를 선택해 주세요.",
    })
  })

  it("uses an income category for a card approval cancellation", () => {
    const incomeCategory = {
      ...context.categories[0]!,
      id: "category-income",
      name: "환불",
      type: "income" as const,
      usageTypes: ["income" as const],
    }
    const incomeCandidate: LocalSmsCandidate = {
      ...candidate,
      parsed: {
        ...candidate.parsed,
        cardNotificationEvent: "approval_cancellation",
        type: "income",
      },
    }
    const incomeContext = {
      ...context,
      categories: [...context.categories, incomeCategory],
    }
    const draft = createCandidateRegistrationDraft(
      incomeCandidate,
      incomeContext,
    )

    expect(draft.categoryId).toBe("category-income")
    expect(draft.paymentMethodId).toBe("")
    expect(
      validateCandidateRegistrationDraft(
        draft,
        incomeCandidate,
        incomeContext,
        new Date("2026-08-13T06:00:00.000Z"),
      ),
    ).toEqual({
      valid: true,
      value: {
        input: expect.objectContaining({
          memo: "카드 승인취소",
          type: "income",
        }),
        registrationState: expect.any(Object),
      },
    })
  })

  it("requires a KRW ledger amount for a foreign approval", () => {
    const foreignCandidate: LocalSmsCandidate = {
      ...candidate,
      parsed: {
        ...candidate.parsed,
        amount: 0,
        originalCurrencyAmount: {
          amount: 7.24,
          currencyCode: "USD",
        },
      },
      status: "needs_review",
    }
    const draft = createCandidateRegistrationDraft(foreignCandidate, context)

    expect(draft.amount).toBe("")
    expect(
      validateCandidateRegistrationDraft(
        draft,
        foreignCandidate,
        context,
        new Date("2026-08-13T06:00:00.000Z"),
      ),
    ).toEqual({
      valid: false,
      message: "금액을 1원 이상 숫자로 입력해 주세요.",
    })
    expect(
      validateCandidateRegistrationDraft(
        { ...draft, amount: "10500" },
        foreignCandidate,
        context,
        new Date("2026-08-13T06:00:00.000Z"),
      ),
    ).toEqual({
      valid: true,
      value: {
        input: expect.objectContaining({
          amount: 10_500,
          memo: "원승인금액 USD 7.24",
        }),
        registrationState: expect.any(Object),
      },
    })
  })

  it("locks a pending registration to the previously persisted values", () => {
    const pendingCandidate: LocalSmsCandidate = {
      ...candidate,
      registrationState: {
        amount: 45_000,
        categoryId: "category-1",
        merchantName: "테스트주유소",
        targetLedgerId: "ledger-1",
        transactionAt: "2026-08-13T14:00:00+09:00",
        updatedAt: "2026-08-13T05:01:00.000Z",
      },
      status: "registration_pending",
    }
    const draft = createCandidateRegistrationDraft(pendingCandidate, context)

    expect(
      validateCandidateRegistrationDraft(
        { ...draft, amount: "46000" },
        pendingCandidate,
        context,
        new Date("2026-08-13T06:00:00.000Z"),
      ),
    ).toEqual({
      valid: false,
      message:
        "등록 결과가 불명확한 후보는 중복 방지를 위해 내용을 변경할 수 없습니다. 저장했던 내용으로 다시 시도해 주세요.",
    })
  })

  it("classifies only connection failures as retryable", () => {
    expect(
      isRetryableCandidateRegistrationError(new Error("network unavailable")),
    ).toBe(true)
    expect(
      isRetryableCandidateRegistrationError(new Error("permission denied")),
    ).toBe(false)
  })
})
