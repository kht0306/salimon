import { beforeEach, describe, expect, it, vi } from "vitest"
import { darkMobileTheme, mobileTheme, resolveMobileTheme } from "."
import { loadThemeMode, saveThemeMode } from "./themePreference"

const storedPreferences = new Map<string, string>()

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(
    async (key: string) => storedPreferences.get(key) ?? null,
  ),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    storedPreferences.set(key, value)
  }),
}))

beforeEach(() => storedPreferences.clear())

describe("mobile theme preference", () => {
  it("defaults to the device theme on first launch or invalid stored preference", async () => {
    expect(await loadThemeMode()).toBe("system")
    storedPreferences.set("salimon.theme-mode", "invalid")
    expect(await loadThemeMode()).toBe("system")
  })

  it("restores each saved mode across launches", async () => {
    for (const mode of ["dark", "light", "system"] as const) {
      await saveThemeMode(mode)
      expect(await loadThemeMode()).toBe(mode)
    }
  })

  it("follows device changes only in system mode", () => {
    expect(resolveMobileTheme("system", "dark")).toBe(darkMobileTheme)
    expect(resolveMobileTheme("system", "light")).toBe(mobileTheme)
    expect(resolveMobileTheme("system", null)).toBe(mobileTheme)
    expect(resolveMobileTheme("light", "dark")).toBe(mobileTheme)
    expect(resolveMobileTheme("dark", "light")).toBe(darkMobileTheme)
  })

  it("keeps accent buttons and Kakao login text legible in both modes", () => {
    for (const theme of [mobileTheme, darkMobileTheme]) {
      expect(
        contrast(theme.colors.teal, theme.colors.onAccent),
      ).toBeGreaterThanOrEqual(4.5)
      expect(contrast("#fee500", theme.colors.onKakao)).toBeGreaterThanOrEqual(
        4.5,
      )
      expect(
        contrast(theme.colors.panel, theme.colors.ink),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

function contrast(first: string, second: string): number {
  function luminance(hex: string): number {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const values = [luminance(first), luminance(second)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}
