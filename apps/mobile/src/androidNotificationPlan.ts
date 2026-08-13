import type { LocalSmsCandidate } from "@salimon/types"
import { createCandidateFromNotificationRecord } from "./features/notification-inbox/notificationInbox"

export function createCandidateFromAndroidNotification(input: {
  recordId?: string
  userId: string
  targetLedgerId: string
  rawText: string
  sourceApp: string
  receivedAt: Date
}): LocalSmsCandidate {
  return createCandidateFromNotificationRecord({
    record: {
      capturedAt: input.receivedAt.getTime(),
      expandedText: input.rawText,
      id: input.recordId ?? `legacy-${input.receivedAt.getTime()}`,
      receivedAt: input.receivedAt.getTime(),
      sourcePackageName: input.sourceApp,
      text: input.rawText,
      title: "",
    },
    targetLedgerId: input.targetLedgerId,
    userId: input.userId,
  })
}
