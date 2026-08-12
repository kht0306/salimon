import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearNotificationCaptureSession,
  configureNotificationCapture,
  deleteExpiredNotificationRecords,
  deleteStoredNotificationRecord,
  getNotificationCaptureStatus,
  readStoredNotificationRecords,
  setAuthenticatedNotificationCaptureUser,
} from "./notificationListener"

const nativeModule = vi.hoisted(() => ({
  clearSessionAndRecords: vi.fn(async () => undefined),
  configureCapture: vi.fn(),
  deleteAllRecords: vi.fn(async () => undefined),
  deleteExpiredRecords: vi.fn(),
  deleteRecord: vi.fn(),
  getStatus: vi.fn(),
  openNotificationAccessSettings: vi.fn(async () => undefined),
  readRecords: vi.fn(),
  setAuthenticatedUser: vi.fn(async () => undefined),
}))

vi.mock("../../modules/salimon-notification-listener/src", () => ({
  default: nativeModule,
}))

const captureStatus = {
  allowedPackageNames: ["com.example.card"],
  hasNotificationAccess: true,
  isCollectionEnabled: true,
  retentionDays: 7,
  storedRecordCount: 1,
}

describe("notification listener bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("forwards session and allowlist configuration to the native module", async () => {
    nativeModule.configureCapture.mockResolvedValue(captureStatus)

    await setAuthenticatedNotificationCaptureUser("user-1")
    const status = await configureNotificationCapture({
      allowedPackageNames: ["com.example.card"],
      enabled: true,
    })

    expect(nativeModule.setAuthenticatedUser).toHaveBeenCalledWith("user-1")
    expect(nativeModule.configureCapture).toHaveBeenCalledWith({
      allowedPackageNames: ["com.example.card"],
      enabled: true,
    })
    expect(status).toEqual(captureStatus)
  })

  it("returns stored records and forwards lifecycle deletion calls", async () => {
    const record = {
      capturedAt: 1_786_547_200_000,
      expandedText: "승인 12,000원",
      id: "a".repeat(64),
      receivedAt: 1_786_547_200_000,
      sourcePackageName: "com.example.card",
      text: "승인",
      title: "카드 알림",
    }
    nativeModule.getStatus.mockResolvedValue(captureStatus)
    nativeModule.readRecords.mockResolvedValue([record])
    nativeModule.deleteRecord.mockResolvedValue(true)
    nativeModule.deleteExpiredRecords.mockResolvedValue(2)

    await expect(getNotificationCaptureStatus()).resolves.toEqual(captureStatus)
    await expect(readStoredNotificationRecords()).resolves.toEqual([record])
    await expect(deleteStoredNotificationRecord(record.id)).resolves.toBe(true)
    await expect(deleteExpiredNotificationRecords()).resolves.toBe(2)

    await clearNotificationCaptureSession()
    expect(nativeModule.clearSessionAndRecords).toHaveBeenCalledOnce()
  })
})
