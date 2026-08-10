import type { SupabaseAuthStorage } from "@salimon/api-client"
import * as SecureStore from "expo-secure-store"

const MANIFEST_PREFIX = "salimon-secure-store-v1:"
const MAX_CHUNK_BYTES = 1800
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: "salimon.auth.session",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export interface SecureStoreDriver {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

interface ChunkManifest {
  version: 1
  generation: string
  count: number
}

const expoSecureStoreDriver: SecureStoreDriver = {
  getItem: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
}

export const secureAuthStorage = createChunkedAuthStorage(expoSecureStoreDriver)

export function createChunkedAuthStorage(
  driver: SecureStoreDriver,
): SupabaseAuthStorage {
  return {
    async getItem(key): Promise<string | null> {
      const storedValue = await driver.getItem(key)
      if (storedValue === null) return null

      const manifest = parseManifest(storedValue)
      if (!manifest) return storedValue

      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, index) =>
          driver.getItem(chunkKey(key, manifest.generation, index)),
        ),
      )
      if (chunks.some((chunk) => chunk === null)) {
        throw new Error("저장된 로그인 세션이 손상되었습니다.")
      }

      return chunks.join("")
    },

    async setItem(key, value): Promise<void> {
      const previousManifest = parseManifest(await driver.getItem(key))
      const generation = createGeneration()
      const chunks = splitByUtf8Bytes(value, MAX_CHUNK_BYTES)

      for (const [index, chunk] of chunks.entries()) {
        await driver.setItem(chunkKey(key, generation, index), chunk)
      }
      await driver.setItem(
        key,
        `${MANIFEST_PREFIX}${JSON.stringify({
          version: 1,
          generation,
          count: chunks.length,
        } satisfies ChunkManifest)}`,
      )

      if (previousManifest) {
        await removeChunks(driver, key, previousManifest)
      }
    },

    async removeItem(key): Promise<void> {
      const storedValue = await driver.getItem(key)
      let manifest: ChunkManifest | null = null
      try {
        manifest = parseManifest(storedValue)
      } catch {
        await driver.removeItem(key)
        return
      }

      await driver.removeItem(key)
      if (manifest) {
        await removeChunks(driver, key, manifest)
      }
    },
  }
}

function parseManifest(value: string | null): ChunkManifest | null {
  if (!value?.startsWith(MANIFEST_PREFIX)) return null

  try {
    const parsed: unknown = JSON.parse(value.slice(MANIFEST_PREFIX.length))
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "generation" in parsed &&
      typeof parsed.generation === "string" &&
      "count" in parsed &&
      Number.isInteger(parsed.count) &&
      typeof parsed.count === "number" &&
      parsed.count > 0
    ) {
      return {
        version: 1,
        generation: parsed.generation,
        count: parsed.count,
      }
    }
  } catch {
    throw new Error("저장된 로그인 세션 정보가 올바르지 않습니다.")
  }

  throw new Error("저장된 로그인 세션 정보가 올바르지 않습니다.")
}

function splitByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (value.length === 0) return [""]

  const chunks: string[] = []
  let currentChunk = ""
  let currentBytes = 0

  for (const character of value) {
    const characterBytes = utf8ByteLength(character)
    if (currentChunk && currentBytes + characterBytes > maxBytes) {
      chunks.push(currentChunk)
      currentChunk = ""
      currentBytes = 0
    }

    currentChunk += character
    currentBytes += characterBytes
  }

  if (currentChunk) chunks.push(currentChunk)
  return chunks
}

function utf8ByteLength(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0
  if (codePoint <= 0x7f) return 1
  if (codePoint <= 0x7ff) return 2
  if (codePoint <= 0xffff) return 3
  return 4
}

function createGeneration(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${key}.${generation}.${index}`
}

async function removeChunks(
  driver: SecureStoreDriver,
  key: string,
  manifest: ChunkManifest,
): Promise<void> {
  for (let index = 0; index < manifest.count; index += 1) {
    await driver.removeItem(chunkKey(key, manifest.generation, index))
  }
}
