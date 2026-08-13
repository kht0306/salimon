import { maskSensitiveText, parseCardSmsText } from "@salimon/domain"
import type { LocalSmsCandidate } from "@salimon/types"

export const SUPPORTED_NOTIFICATION_APPS = [
  { name: "롯데카드", packageName: "com.lotte" },
] as const

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
    paymentMethodId: string
    targetLedgerId: string
    transactionAt: string
    updatedAt: number
  }
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
        paymentMethodId:
          input.record.registrationState.paymentMethodId || undefined,
        targetLedgerId: input.record.registrationState.targetLedgerId,
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
    sourceHash: parsed.normalizedHash,
    sourceApp: input.record.sourcePackageName,
    maskedMessage: parsed.rawTextMasked ?? maskSensitiveText(rawText),
    parsed: candidateParsed,
    status: registrationState
      ? "registration_pending"
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
  return candidate.status === "needs_review" ? "검토 필요" : "등록 가능"
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
