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

  useEffect(() => {
    const refresh = () => {
      if (!store.authUser || store.dataState === "loading") return
      void store.refreshFinanceData()
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }

    window.addEventListener("focus", refresh)
    window.addEventListener("online", refresh)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("online", refresh)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
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
