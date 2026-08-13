import { requireOptionalNativeModule } from "expo"

export interface NativeNotificationCaptureConfiguration {
  allowedPackageNames: string[]
  enabled: boolean
  reviewNotificationsEnabled: boolean
  targetLedgerId: string
}

export interface NativeNotificationCaptureStatus {
  allowedPackageNames: string[]
  disclosureAcceptedAt: number
  hasNotificationAccess: boolean
  hasDisclosureConsent: boolean
  isCollectionEnabled: boolean
  reviewNotificationsEnabled: boolean
  retentionDays: number
  storedRecordCount: number
  targetLedgerId: string
}

export interface NativeNotificationRecord {
  capturedAt: number
  expandedText: string
  id: string
  receivedAt: number
  sourcePackageName: string
  text: string
  title: string
}

export interface SalimonNotificationListenerNativeModule {
  acceptDisclosure(): Promise<NativeNotificationCaptureStatus>
  clearSessionAndRecords(): Promise<void>
  configureCapture(
    configuration: NativeNotificationCaptureConfiguration,
  ): Promise<NativeNotificationCaptureStatus>
  deleteAllRecords(): Promise<void>
  deleteExpiredRecords(): Promise<number>
  deleteRecord(id: string): Promise<boolean>
  getStatus(): Promise<NativeNotificationCaptureStatus>
  openNotificationAccessSettings(): Promise<void>
  readRecords(): Promise<NativeNotificationRecord[]>
  revokeDisclosureAndDeleteRecords(): Promise<NativeNotificationCaptureStatus>
  setAuthenticatedUser(userId: string): Promise<void>
}

export default requireOptionalNativeModule<SalimonNotificationListenerNativeModule>(
  "SalimonNotificationListener",
)
