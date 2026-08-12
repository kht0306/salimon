import { requireOptionalNativeModule } from "expo"

export interface NativeNotificationCaptureConfiguration {
  allowedPackageNames: string[]
  enabled: boolean
}

export interface NativeNotificationCaptureStatus {
  allowedPackageNames: string[]
  hasNotificationAccess: boolean
  isCollectionEnabled: boolean
  retentionDays: number
  storedRecordCount: number
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
  setAuthenticatedUser(userId: string): Promise<void>
}

export default requireOptionalNativeModule<SalimonNotificationListenerNativeModule>(
  "SalimonNotificationListener",
)
