import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"

export { ErrorBoundary } from "expo-router"

const stackScreenOptions = { headerShown: false } as const

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={stackScreenOptions} />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  )
}
