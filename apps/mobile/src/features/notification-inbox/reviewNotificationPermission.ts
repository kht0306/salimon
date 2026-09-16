import { Alert, PermissionsAndroid, Platform } from "react-native"
import { openReviewNotificationSettings } from "../../native/notificationListener"

export async function requestReviewNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false
  if (Number(Platform.Version) < 33) return true

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  )
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true

  Alert.alert(
    "알림 표시 권한이 꺼져 있어요.",
    "후보는 계속 저장됩니다. 도착 알림을 받으려면 Android 설정에서 알림을 허용한 뒤 후보 도착 알림을 켜 주세요.",
    [
      { text: "닫기", style: "cancel" },
      {
        text: "설정 열기",
        onPress: () => void openReviewNotificationSettings(),
      },
    ],
  )
  return false
}
