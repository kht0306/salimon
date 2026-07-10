"use client"

import { LocalFinanceRepository } from "@salimon/api-client"
import { AppStore } from "@salimon/store"
import { createContext, useContext, useEffect, useMemo } from "react"

const StoreContext = createContext<AppStore | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => new LocalFinanceRepository(), [])
  const store = useMemo(() => new AppStore(repository), [repository])

  useEffect(() => {
    store.hydrate(repository.load())
    const unsubscribe = store.observeAuth()
    void store.initializeAuth()

    return unsubscribe
  }, [repository, store])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error("StoreProvider is missing")
  }

  return store
}
