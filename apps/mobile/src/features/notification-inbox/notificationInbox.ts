import {
  isSupportedCardApprovalText,
  maskSensitiveText,
  parseCardSmsText,
} from "@salimon/domain"
import type { LocalSmsCandidate } from "@salimon/types"

interface SupportedNotificationApp {
  name: string
  packageName: string
  description: string
  cardApprovalsOnly: boolean
}

export const SUPPORTED_NOTIFICATION_APPS = [
  {
    name: "롯데카드",
    packageName: "com.lcacApp",
    description: "롯데카드 앱 결제 알림",
    cardApprovalsOnly: false,
  },
  {
    name: "삼성 메시지",
    packageName: "com.samsung.android.messaging",
    description: "국민·우리카드 정상 승인 문자",
    cardApprovalsOnly: true,
  },
  {
    name: "Google 메시지",
    packageName: "com.google.android.apps.messaging",
    description: "국민·우리카드 정상 승인 문자",
    cardApprovalsOnly: true,
  },
  {
    name: "카카오톡",
    packageName: "com.kakao.talk",
    description: "국민·우리카드 채널의 정상 승인 알림톡",
    cardApprovalsOnly: true,
  },
] as const satisfies readonly SupportedNotificationApp[]

const foreignAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
})
const krwAmountFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
})

export interface NotificationRecordInput {
  capturedAt: number
  expandedText: string
  id: string
  receivedAt: number
  sourcePackageName: string
  text: string
  title: string
  registrationState?: {
    amount: number
    categoryId: string
    merchantName: string
    memo?: string
    paymentMethodId: string
    targetLedgerId: string
    tags?: string[]
    transactionAt: string
    updatedAt: number
  }
}

export function isSupportedNotificationRecord(
  record: NotificationRecordInput,
): boolean {
  if (
    !SUPPORTED_NOTIFICATION_APPS.find(
      (app) => app.packageName === record.sourcePackageName,
    )?.cardApprovalsOnly
  )
    return true
  const body = record.expandedText.trim() || record.text.trim()
  return (
    isSupportedCardApprovalText(body) &&
    (record.sourcePackageName !== "com.kakao.talk" ||
      /우리카드|KB\s*국민카드/.test(record.title))
  )
}

export function createCandidateFromNotificationRecord(input: {
  record: NotificationRecordInput
  targetLedgerId: string
  userId: string
}): LocalSmsCandidate {
  const rawText = combineNotificationText(input.record)
  const receivedAt = new Date(input.record.receivedAt)
  const parsed = parseCardSmsText(rawText, receivedAt, {
    sourceApp: input.record.sourcePackageName,
    targetLedgerId: input.targetLedgerId,
  })
  const registrationState = input.record.registrationState
    ? {
        amount: input.record.registrationState.amount,
        categoryId: input.record.registrationState.categoryId,
        merchantName: input.record.registrationState.merchantName || undefined,
        memo: input.record.registrationState.memo || undefined,
        paymentMethodId:
          input.record.registrationState.paymentMethodId || undefined,
        targetLedgerId: input.record.registrationState.targetLedgerId,
        tags: input.record.registrationState.tags ?? [],
        transactionAt: input.record.registrationState.transactionAt,
        updatedAt: new Date(
          input.record.registrationState.updatedAt,
        ).toISOString(),
      }
    : undefined
  const candidateParsed = registrationState
    ? {
        ...parsed,
        amount: registrationState.amount,
        merchantName: registrationState.merchantName,
        targetLedgerId: registrationState.targetLedgerId,
        transactionAt: registrationState.transactionAt,
      }
    : parsed

  return {
    id: input.record.id,
    userId: input.userId,
    targetLedgerId: registrationState?.targetLedgerId ?? input.targetLedgerId,
    sourceHash: SUPPORTED_NOTIFICATION_APPS.find(
      (app) => app.packageName === input.record.sourcePackageName,
    )?.cardApprovalsOnly
      ? `notification_${input.record.id}`
      : parsed.normalizedHash,
    sourceApp: input.record.sourcePackageName,
    maskedMessage: parsed.rawTextMasked ?? maskSensitiveText(rawText),
    parsed: candidateParsed,
    status: registrationState
      ? "registration_pending"
      : parsed.originalCurrencyAmount
        ? "needs_review"
        : parsed.confidence >= 0.85
          ? "notified"
          : "needs_review",
    promptCount: 0,
    firstDetectedAt: receivedAt.toISOString(),
    reviewDeadlineAt: new Date(
      input.record.receivedAt + 7 * 24 * 60 * 60 * 1_000,
    ).toISOString(),
    registrationState,
  }
}

export function candidateStatusLabel(candidate: LocalSmsCandidate): string {
  if (candidate.status === "registration_pending") return "등록 대기"
  if (candidate.status === "deferred") return "미룸"
  if (candidate.parsed.originalCurrencyAmount) return "원화 금액 필요"
  return candidate.status === "needs_review" ? "검토 필요" : "등록 가능"
}

export function candidateAmountLabel(candidate: LocalSmsCandidate): string {
  const originalAmount = candidate.parsed.originalCurrencyAmount
  if (originalAmount) {
    return `${originalAmount.currencyCode} ${foreignAmountFormatter.format(originalAmount.amount)}`
  }

  return krwAmountFormatter.format(candidate.parsed.amount)
}

export function cardNotificationEventLabel(
  candidate: LocalSmsCandidate,
): string | undefined {
  if (candidate.parsed.cardNotificationEvent === "approval_cancellation") {
    return "승인취소"
  }
  if (candidate.parsed.originalCurrencyAmount) return "해외 승인"
  return candidate.parsed.cardNotificationEvent === "approval"
    ? "정상 승인"
    : undefined
}

export function notificationAppName(packageName?: string): string {
  return (
    SUPPORTED_NOTIFICATION_APPS.find((app) => app.packageName === packageName)
      ?.name ?? "결제 앱"
  )
}

function combineNotificationText(record: NotificationRecordInput): string {
  const body = record.expandedText.trim() || record.text.trim()
  return [...new Set([record.title.trim(), body].filter(Boolean))].join("\n")
}
