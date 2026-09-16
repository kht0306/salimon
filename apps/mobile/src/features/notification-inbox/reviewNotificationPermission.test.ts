import { beforeEach, describe, expect, it, vi } from "vitest"
import { requestReviewNotificationPermission } from "./reviewNotificationPermission"

const mocks = vi.hoisted(() => ({
  platform: { OS: "android", Version: 33 },
  request: vi.fn(),
  alert: vi.fn(),
  openSettings: vi.fn(),
}))
vi.mock("react-native", () => ({
  Platform: mocks.platform,
  Alert: { alert: mocks.alert },
  PermissionsAndroid: {
    request: mocks.request,
    PERMISSIONS: {
      POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS",
    },
    RESULTS: { GRANTED: "granted" },
  },
}))
vi.mock("../../native/notificationListener", () => ({
  openReviewNotificationSettings: mocks.openSettings,
}))

describe("candidate arrival notification permission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.platform.OS = "android"
    mocks.platform.Version = 33
  })
  it("enables arrival notifications when Android grants permission", async () => {
    mocks.request.mockResolvedValue("granted")
    expect(await requestReviewNotificationPermission()).toBe(true)
    expect(mocks.request).toHaveBeenCalledWith(
      "android.permission.POST_NOTIFICATIONS",
    )
    expect(mocks.alert).not.toHaveBeenCalled()
  })
  it.each(["denied", "never_ask_again"])(
    "keeps notifications disabled and offers settings for %s",
    async (result) => {
      mocks.request.mockResolvedValue(result)
      expect(await requestReviewNotificationPermission()).toBe(false)
      expect(mocks.alert).toHaveBeenCalledOnce()
      const buttons = mocks.alert.mock.calls[0]?.[2] as {
        text: string
        onPress?: () => void
      }[]
      buttons.find((button) => button.text === "설정 열기")?.onPress?.()
      expect(mocks.openSettings).toHaveBeenCalledOnce()
    },
  )
  it("does not request runtime permission before Android 13", async () => {
    mocks.platform.Version = 32
    expect(await requestReviewNotificationPermission()).toBe(true)
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
