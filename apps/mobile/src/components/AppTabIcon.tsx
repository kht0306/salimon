import {
  HandCoins,
  Home,
  Inbox,
  List,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react-native"
import { mobileTheme } from "../theme"

interface AppTabIconProps {
  active: boolean
  name: "home" | "inbox" | "settings" | "settlement" | "transactions"
}

const icons: Record<AppTabIconProps["name"], LucideIcon> = {
  home: Home,
  transactions: List,
  inbox: Inbox,
  settlement: HandCoins,
  settings: SlidersHorizontal,
}

export function AppTabIcon({ active, name }: AppTabIconProps) {
  const Icon = icons[name]

  return (
    <Icon
      accessibilityElementsHidden
      color={active ? mobileTheme.colors.teal : mobileTheme.colors.muted}
      importantForAccessibility="no-hide-descendants"
      size={21}
      strokeWidth={active ? 2.2 : 1.8}
    />
  )
}
