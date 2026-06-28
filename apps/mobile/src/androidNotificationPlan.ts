import type { LocalSmsCandidate } from "@salimon/types"
import { parseCardSmsText } from "@salimon/domain"

export function createCandidateFromAndroidNotification(input: {
  userId: string
  targetLedgerId: string
  rawText: string
  sourceApp: string
  receivedAt: Date
}): LocalSmsCandidate {
  const parsed = parseCardSmsText(input.rawText, input.receivedAt, {
    sourceApp: input.sourceApp,
    targetLedgerId: input.targetLedgerId,
  })
  const now = new Date()

  return {
    id: `sms-${parsed.normalizedHash}`,
    userId: input.userId,
    targetLedgerId: input.targetLedgerId,
    sourceHash: parsed.normalizedHash,
    sourceApp: input.sourceApp,
    maskedMessage: parsed.rawTextMasked ?? "",
    parsed,
    status: parsed.confidence >= 0.85 ? "notified" : "needs_review",
    promptCount: 1,
    firstDetectedAt: now.toISOString(),
    lastPromptedAt: now.toISOString(),
    reviewDeadlineAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}
