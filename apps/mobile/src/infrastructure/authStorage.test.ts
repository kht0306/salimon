import { beforeEach, describe, expect, it, vi } from "vitest"
import { createChunkedAuthStorage, type SecureStoreDriver } from "./authStorage"

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}))

function createMemoryDriver() {
  const values = new Map<string, string>()
  const driver: SecureStoreDriver = {
    getItem: vi.fn(async (key) => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => {
      values.set(key, value)
    }),
    removeItem: vi.fn(async (key) => {
      values.delete(key)
    }),
  }
  return { driver, values }
}

describe("createChunkedAuthStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("stores and restores a session larger than one SecureStore item", async () => {
    const { driver, values } = createMemoryDriver()
    const storage = createChunkedAuthStorage(driver)
    const session = `${"가족세션".repeat(700)}-${"token".repeat(500)}`

    await storage.setItem("auth-key", session)

    expect(await storage.getItem("auth-key")).toBe(session)
    const chunks = [...values.entries()].filter(([key]) =>
      key.startsWith("auth-key."),
    )
    expect(chunks.length).toBeGreaterThan(1)
    for (const [, value] of chunks) {
      expect(utf8ByteLength(value)).toBeLessThanOrEqual(1800)
    }
  })

  it("removes the previous generation after replacing a session", async () => {
    const { driver, values } = createMemoryDriver()
    const storage = createChunkedAuthStorage(driver)

    await storage.setItem("auth-key", "old-session".repeat(400))
    const previousChunkKeys = [...values.keys()].filter((key) =>
      key.startsWith("auth-key."),
    )
    await storage.setItem("auth-key", "new-session")

    expect(await storage.getItem("auth-key")).toBe("new-session")
    for (const key of previousChunkKeys) {
      expect(values.has(key)).toBe(false)
    }
  })

  it("removes the manifest and all chunks on logout", async () => {
    const { driver, values } = createMemoryDriver()
    const storage = createChunkedAuthStorage(driver)

    await storage.setItem("auth-key", "session".repeat(600))
    await storage.removeItem("auth-key")

    expect(values.size).toBe(0)
    expect(await storage.getItem("auth-key")).toBeNull()
  })

  it("rejects a damaged manifest instead of returning it as a session", async () => {
    const { driver, values } = createMemoryDriver()
    const storage = createChunkedAuthStorage(driver)
    values.set("auth-key", "salimon-secure-store-v1:{broken")

    await expect(storage.getItem("auth-key")).rejects.toThrow(
      "저장된 로그인 세션 정보가 올바르지 않습니다.",
    )
  })

  it("removes a damaged manifest so the next launch can sign in again", async () => {
    const { driver, values } = createMemoryDriver()
    const storage = createChunkedAuthStorage(driver)
    values.set("auth-key", "salimon-secure-store-v1:{broken")

    await storage.removeItem("auth-key")

    expect(await storage.getItem("auth-key")).toBeNull()
  })
})

function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 0x7f) bytes += 1
    else if (codePoint <= 0x7ff) bytes += 2
    else if (codePoint <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}
