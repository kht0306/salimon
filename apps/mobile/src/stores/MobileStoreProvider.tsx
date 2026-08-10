import { createContext, type ReactNode, useContext } from "react"
import type { MobileAppStore } from "./mobileAppStore"

const MobileStoreContext = createContext<MobileAppStore | null>(null)

interface MobileStoreProviderProps {
  children: ReactNode
  store: MobileAppStore
}

export function MobileStoreProvider({
  children,
  store,
}: MobileStoreProviderProps) {
  return (
    <MobileStoreContext.Provider value={store}>
      {children}
    </MobileStoreContext.Provider>
  )
}

export function useMobileAppStore(): MobileAppStore {
  const store = useContext(MobileStoreContext)
  if (!store) {
    throw new Error("모바일 앱 스토어가 연결되지 않았습니다.")
  }
  return store
}
