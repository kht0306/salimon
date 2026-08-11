import { describe, expect, it } from "vitest"
import { QueryCache } from "./queryCache"

describe("QueryCache", () => {
  it("marks entries stale after the configured freshness window", () => {
    let now = 1_000
    const cache = new QueryCache<string>({
      now: () => now,
      staleTimeMs: 500,
    })

    cache.set("user-1:2026-08", "august")
    expect(cache.get("user-1:2026-08")).toEqual({
      data: "august",
      isFresh: true,
    })

    now = 1_501
    expect(cache.get("user-1:2026-08")).toEqual({
      data: "august",
      isFresh: false,
    })
  })

  it("keeps only the most recently used entries", () => {
    const cache = new QueryCache<string>({ maxEntries: 2 })
    cache.set("june", "6")
    cache.set("july", "7")
    cache.get("june")
    cache.set("august", "8")

    expect(cache.get("june")?.data).toBe("6")
    expect(cache.get("july")).toBeUndefined()
    expect(cache.get("august")?.data).toBe("8")
  })

  it("clears all entries on demand", () => {
    const cache = new QueryCache<string>()
    cache.set("user-1:2026-08", "august")

    cache.clear()

    expect(cache.get("user-1:2026-08")).toBeUndefined()
  })
})
