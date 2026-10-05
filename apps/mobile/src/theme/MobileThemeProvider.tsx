import { ThemeProvider } from "@emotion/react"
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import { Appearance, Platform, useColorScheme } from "react-native"
import { resolveMobileTheme, type ThemeMode } from "."
import { loadThemeMode, saveThemeMode } from "./themePreference"

interface ThemePreference {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => Promise<void>
}

interface MobileThemeProviderProps {
  children: ReactNode
}

const ThemePreferenceContext = createContext<ThemePreference | null>(null)

export function MobileThemeProvider({ children }: MobileThemeProviderProps) {
  const systemColorScheme = useColorScheme()
  const [mode, setMode] = useState<ThemeMode>("system")
  const [loaded, setLoaded] = useState(false)
  const theme = resolveMobileTheme(mode, systemColorScheme)

  useEffect(() => {
    let active = true
    void loadThemeMode()
      .then((savedMode) => {
        if (active) setMode(savedMode)
      })
      .catch(() => {
        // Keep following the system if the device preference cannot be read.
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (loaded && Platform.OS !== "web") {
      Appearance.setColorScheme(mode === "system" ? "unspecified" : mode)
    }
  }, [loaded, mode])

  async function updateMode(nextMode: ThemeMode): Promise<void> {
    await saveThemeMode(nextMode)
    setMode(nextMode)
  }

  if (!loaded) return null

  const navigationTheme = theme.isDark ? DarkTheme : DefaultTheme

  return (
    <ThemePreferenceContext.Provider value={{ mode, setMode: updateMode }}>
      <ThemeProvider theme={theme}>
        <NavigationThemeProvider
          value={{
            ...navigationTheme,
            colors: {
              ...navigationTheme.colors,
              primary: theme.colors.teal,
              background: theme.colors.canvas,
              card: theme.colors.panel,
              text: theme.colors.ink,
              border: theme.colors.border,
              notification: theme.colors.coral,
            },
          }}
        >
          {children}
        </NavigationThemeProvider>
      </ThemeProvider>
    </ThemePreferenceContext.Provider>
  )
}

export function useThemePreference(): ThemePreference {
  const preference = useContext(ThemePreferenceContext)
  if (!preference) {
    throw new Error("모바일 테마 설정이 연결되지 않았습니다.")
  }
  return preference
}
