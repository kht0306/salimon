import * as SecureStore from "expo-secure-store"
import type { ThemeMode } from "."

const themePreferenceKey = "salimon.theme-mode"

export async function loadThemeMode(): Promise<ThemeMode> {
  const value = await SecureStore.getItemAsync(themePreferenceKey)
  return value === "light" || value === "dark" ? value : "system"
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await SecureStore.setItemAsync(themePreferenceKey, mode)
}
