export const MOBILE_QUERY_CACHE_STALE_TIME_MS = 5 * 60 * 1_000
export const MOBILE_QUERY_CACHE_MAX_ENTRIES = 6

interface QueryCacheEntry<T> {
  data: T
  storedAt: number
}

export interface QueryCacheResult<T> {
  data: T
  isFresh: boolean
}

export interface QueryCacheOptions {
  maxEntries?: number
  now?: () => number
  staleTimeMs?: number
}

export class QueryCache<T> {
  private readonly entries = new Map<string, QueryCacheEntry<T>>()
  private readonly maxEntries: number
  private readonly now: () => number
  private readonly staleTimeMs: number

  constructor({
    maxEntries = MOBILE_QUERY_CACHE_MAX_ENTRIES,
    now = Date.now,
    staleTimeMs = MOBILE_QUERY_CACHE_STALE_TIME_MS,
  }: QueryCacheOptions = {}) {
    this.maxEntries = maxEntries
    this.now = now
    this.staleTimeMs = staleTimeMs
  }

  get(key: string): QueryCacheResult<T> | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    this.entries.delete(key)
    this.entries.set(key, entry)

    return {
      data: entry.data,
      isFresh: this.now() - entry.storedAt <= this.staleTimeMs,
    }
  }

  set(key: string, data: T): void {
    this.entries.delete(key)
    this.entries.set(key, { data, storedAt: this.now() })

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) return
      this.entries.delete(oldestKey)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
