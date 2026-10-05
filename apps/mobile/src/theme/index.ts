import {
  nativeColors,
  nativeControls,
  nativeRadii,
  nativeSpacing,
  nativeTypography,
} from "@salimon/ui-tokens"

export type ThemeMode = "system" | "light" | "dark"

export interface MobileTheme {
  colors: Record<keyof typeof nativeColors, string> & {
    onAccent: string
    onKakao: string
    overlay: string
    scrim: string
  }
  isDark: boolean
  controls: typeof nativeControls
  radii: typeof nativeRadii
  spacing: typeof nativeSpacing
  typography: typeof nativeTypography
}

declare module "@emotion/react" {
  export interface Theme {
    colors: MobileTheme["colors"]
    isDark: MobileTheme["isDark"]
    controls: MobileTheme["controls"]
    radii: MobileTheme["radii"]
    spacing: MobileTheme["spacing"]
    typography: MobileTheme["typography"]
  }
}

export const mobileTheme: MobileTheme = {
  colors: {
    ...nativeColors,
    onAccent: "#ffffff",
    onKakao: "#18181b",
    overlay: "rgba(247, 248, 248, 0.86)",
    scrim: "rgba(24, 24, 27, 0.38)",
  },
  isDark: false,
  controls: nativeControls,
  radii: nativeRadii,
  spacing: nativeSpacing,
  typography: nativeTypography,
}

export const darkMobileTheme: MobileTheme = {
  ...mobileTheme,
  isDark: true,
  colors: {
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    subtle: "#71717a",
    canvas: "#111113",
    panel: "#18181b",
    panelSubtle: "#202024",
    border: "#3f3f46",
    borderStrong: "#52525b",
    teal: "#5eead4",
    tealSoft: "#123b37",
    green: "#4ade80",
    greenSoft: "#12351f",
    coral: "#f87171",
    coralSoft: "#3f1d22",
    amber: "#fbbf24",
    amberSoft: "#422f10",
    violet: "#c4b5fd",
    violetSoft: "#30234f",
    blue: "#93c5fd",
    blueSoft: "#172e4d",
    focus: "#60a5fa",
    onAccent: "#111113",
    onKakao: "#18181b",
    overlay: "rgba(17, 17, 19, 0.86)",
    scrim: "rgba(0, 0, 0, 0.6)",
  },
}

export function resolveMobileTheme(
  mode: ThemeMode,
  systemColorScheme: string | null | undefined,
): MobileTheme {
  return (mode === "system" ? systemColorScheme === "dark" : mode === "dark")
    ? darkMobileTheme
    : mobileTheme
}
