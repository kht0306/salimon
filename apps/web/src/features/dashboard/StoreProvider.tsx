"use client"

import { AppStore } from "@salimon/store"
import { createContext, useContext, useEffect, useMemo } from "react"

const StoreContext = createContext<AppStore | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => new AppStore(), [])

  useEffect(() => {
    const unsubscribe = store.observeAuth()
    void store.initializeAuth()

    return unsubscribe
  }, [store])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error("StoreProvider is missing")
  }

  return store
}
