import { afterEach, describe, expect, it, vi } from "vitest"
import { selectAndParseReceipt } from "./receiptClient"
import { parseReceiptResult } from "./receiptResponse"

const receiptMocks = vi.hoisted(() => ({
  getCurrentAccessToken: vi.fn(async () => "test-token"),
  launchCameraAsync: vi.fn(async () => ({
    canceled: false,
    assets: [
      {
        uri: "file:///camera-receipt.jpg",
        width: 8160,
        height: 6120,
        type: "image",
      },
    ],
  })),
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  resize: vi.fn(),
  saveAsync: vi.fn(async () => ({ uri: "file:///prepared-receipt.jpg" })),
}))

vi.mock("@salimon/api-client", () => ({
  getCurrentAccessToken: receiptMocks.getCurrentAccessToken,
}))

vi.mock("expo-image-picker", () => ({
  launchCameraAsync: receiptMocks.launchCameraAsync,
  launchImageLibraryAsync: vi.fn(),
  requestCameraPermissionsAsync: receiptMocks.requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync: vi.fn(),
}))

vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: vi.fn(() => ({
      resize: receiptMocks.resize,
      renderAsync: vi.fn(async () => ({ saveAsync: receiptMocks.saveAsync })),
    })),
  },
  SaveFormat: { JPEG: "jpeg" },
}))

vi.mock("../../infrastructure/supabase", () => ({
  requireSupabaseMobileClient: vi.fn(() => ({})),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("mobile receipt client", () => {
  it("accepts a complete receipt response", () => {
    expect(
      parseReceiptResult({
        amount: 12_300,
        merchantName: "동네마트",
        transactionAt: "2026-08-22T19:20:00+09:00",
        categoryHint: "생활비",
        confidence: 0.91,
        warnings: ["카드 번호를 확인해 주세요."],
        provider: "gemini",
        model: "gemini-test",
        dataTier: "free",
      }),
    ).toMatchObject({
      amount: 12_300,
      merchantName: "동네마트",
      confidence: 0.91,
    })
  })

  it("rejects malformed or unsafe responses", () => {
    expect(() =>
      parseReceiptResult({
        amount: 0,
        merchantName: "",
        transactionAt: "not-a-date",
        confidence: 2,
        warnings: [],
        provider: "gemini",
        model: "gemini-test",
        dataTier: "free",
      }),
    ).toThrow("영수증 분석 결과가 올바르지 않습니다.")
  })

  it("uploads prepared JPEG bytes without replacing the explicit MIME header", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_URL", "https://example.com")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xff, 0xd8, 0xff, 0x00])),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            amount: 10_000,
            merchantName: "그린토피아",
            transactionAt: "2026-08-22T19:06:27+09:00",
            confidence: 0.9,
            warnings: [],
            provider: "gemini",
            model: "gemini-test",
            dataTier: "free",
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(selectAndParseReceipt("camera")).resolves.toMatchObject({
      amount: 10_000,
      merchantName: "그린토피아",
    })

    const uploadInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect(uploadInit?.headers).toMatchObject({
      "Content-Type": "image/jpeg",
    })
    expect(uploadInit?.body).toBeInstanceOf(ArrayBuffer)
    expect(uploadInit?.body).not.toBeInstanceOf(Blob)
  })
})
