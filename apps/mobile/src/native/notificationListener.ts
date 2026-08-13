import SalimonNotificationListener, {
  type NativeNotificationCaptureConfiguration,
  type NativeNotificationCaptureStatus,
  type NativeNotificationRecord,
  type NativeNotificationRegistrationState,
} from "../../modules/salimon-notification-listener/src"

const unsupportedStatus: NativeNotificationCaptureStatus = {
  allowedPackageNames: [],
  disclosureAcceptedAt: 0,
  hasNotificationAccess: false,
  hasDisclosureConsent: false,
  isCollectionEnabled: false,
  reviewNotificationsEnabled: false,
  retentionDays: 7,
  storedRecordCount: 0,
  targetLedgerId: "",
}

export type NotificationCaptureConfiguration =
  NativeNotificationCaptureConfiguration
export type NotificationCaptureStatus = NativeNotificationCaptureStatus
export type StoredNotificationRecord = NativeNotificationRecord
export type StoredNotificationRegistrationState = Omit<
  NativeNotificationRegistrationState,
  "updatedAt"
>

export async function acceptNotificationDisclosure(): Promise<NotificationCaptureStatus> {
  return (
    (await SalimonNotificationListener?.acceptDisclosure()) ?? unsupportedStatus
  )
}

export async function revokeNotificationDisclosure(): Promise<NotificationCaptureStatus> {
  return (
    (await SalimonNotificationListener?.revokeDisclosureAndDeleteRecords()) ??
    unsupportedStatus
  )
}

export async function setAuthenticatedNotificationCaptureUser(
  userId: string,
): Promise<void> {
  await SalimonNotificationListener?.setAuthenticatedUser(userId)
}

export async function clearNotificationCaptureSession(): Promise<void> {
  await SalimonNotificationListener?.clearSessionAndRecords()
}

export async function configureNotificationCapture(
  configuration: NotificationCaptureConfiguration,
): Promise<NotificationCaptureStatus> {
  return (
    (await SalimonNotificationListener?.configureCapture(configuration)) ??
    unsupportedStatus
  )
}

export async function getNotificationCaptureStatus(): Promise<NotificationCaptureStatus> {
  return (await SalimonNotificationListener?.getStatus()) ?? unsupportedStatus
}

export async function openNotificationAccessSettings(): Promise<void> {
  await SalimonNotificationListener?.openNotificationAccessSettings()
}

export async function readStoredNotificationRecords(): Promise<
  StoredNotificationRecord[]
> {
  return (await SalimonNotificationListener?.readRecords()) ?? []
}

export async function deleteStoredNotificationRecord(
  recordId: string,
): Promise<boolean> {
  return (await SalimonNotificationListener?.deleteRecord(recordId)) ?? false
}

export async function saveStoredNotificationRegistrationState(
  recordId: string,
  state: StoredNotificationRegistrationState,
): Promise<boolean> {
  return (
    (await SalimonNotificationListener?.saveRegistrationState(
      recordId,
      state,
    )) ?? false
  )
}

export async function deleteExpiredNotificationRecords(): Promise<number> {
  return (await SalimonNotificationListener?.deleteExpiredRecords()) ?? 0
}

export async function deleteAllStoredNotificationRecords(): Promise<void> {
  await SalimonNotificationListener?.deleteAllRecords()
}
