import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  acceptNotificationDisclosure,
  clearNotificationCaptureSession,
  configureNotificationCapture,
  deleteAllStoredNotificationRecords,
  deleteExpiredNotificationRecords,
  deleteStoredNotificationRecord,
  getNotificationCaptureStatus,
  readStoredNotificationRecords,
  revokeNotificationDisclosure,
  setAuthenticatedNotificationCaptureUser,
  saveStoredNotificationRegistrationState,
} from "./notificationListener"

const nativeModule = vi.hoisted(() => ({
  acceptDisclosure: vi.fn(),
  clearSessionAndRecords: vi.fn(async () => undefined),
  configureCapture: vi.fn(),
  deleteAllRecords: vi.fn(async () => undefined),
  deleteExpiredRecords: vi.fn(),
  deleteRecord: vi.fn(),
  getStatus: vi.fn(),
  openNotificationAccessSettings: vi.fn(async () => undefined),
  readRecords: vi.fn(),
  saveRegistrationState: vi.fn(),
  revokeDisclosureAndDeleteRecords: vi.fn(),
  setAuthenticatedUser: vi.fn(async () => undefined),
}))

vi.mock("../../modules/salimon-notification-listener/src", () => ({
  default: nativeModule,
}))

const captureStatus = {
  allowedPackageNames: ["com.example.card"],
  disclosureAcceptedAt: 1_786_547_200_000,
  hasNotificationAccess: true,
  hasDisclosureConsent: true,
  isCollectionEnabled: true,
  reviewNotificationsEnabled: false,
  retentionDays: 7,
  storedRecordCount: 1,
  targetLedgerId: "ledger-1",
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
      reviewNotificationsEnabled: false,
      targetLedgerId: "ledger-1",
    })

    expect(nativeModule.setAuthenticatedUser).toHaveBeenCalledWith("user-1")
    expect(nativeModule.configureCapture).toHaveBeenCalledWith({
      allowedPackageNames: ["com.example.card"],
      enabled: true,
      reviewNotificationsEnabled: false,
      targetLedgerId: "ledger-1",
    })
    expect(status).toEqual(captureStatus)
  })

  it("forwards explicit disclosure consent and revocation", async () => {
    nativeModule.acceptDisclosure.mockResolvedValue(captureStatus)
    nativeModule.revokeDisclosureAndDeleteRecords.mockResolvedValue({
      ...captureStatus,
      allowedPackageNames: [],
      disclosureAcceptedAt: 0,
      hasDisclosureConsent: false,
      isCollectionEnabled: false,
      storedRecordCount: 0,
      targetLedgerId: "",
    })

    await expect(acceptNotificationDisclosure()).resolves.toEqual(captureStatus)
    await revokeNotificationDisclosure()

    expect(nativeModule.acceptDisclosure).toHaveBeenCalledOnce()
    expect(nativeModule.revokeDisclosureAndDeleteRecords).toHaveBeenCalledOnce()
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
    nativeModule.saveRegistrationState.mockResolvedValue(true)

    await expect(getNotificationCaptureStatus()).resolves.toEqual(captureStatus)
    await expect(readStoredNotificationRecords()).resolves.toEqual([record])
    await expect(deleteStoredNotificationRecord(record.id)).resolves.toBe(true)
    await expect(deleteExpiredNotificationRecords()).resolves.toBe(2)
    await expect(
      saveStoredNotificationRegistrationState(record.id, {
        amount: 12_000,
        categoryId: "category-1",
        merchantName: "테스트상점",
        paymentMethodId: "card-1",
        targetLedgerId: "ledger-1",
        transactionAt: "2026-08-13T14:00:00+09:00",
      }),
    ).resolves.toBe(true)
    expect(nativeModule.saveRegistrationState).toHaveBeenCalledWith(record.id, {
      amount: 12_000,
      categoryId: "category-1",
      merchantName: "테스트상점",
      paymentMethodId: "card-1",
      targetLedgerId: "ledger-1",
      transactionAt: "2026-08-13T14:00:00+09:00",
    })
    await deleteAllStoredNotificationRecords()
    expect(nativeModule.deleteAllRecords).toHaveBeenCalledOnce()

    await clearNotificationCaptureSession()
    expect(nativeModule.clearSessionAndRecords).toHaveBeenCalledOnce()
  })
})
