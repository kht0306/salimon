import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isModelDailyQuotaError,
  matchesImageSignature,
  normalizeReceiptResult,
  POST,
} from "./route"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("receipt parser safeguards", () => {
  it("accepts only matching image signatures", () => {
    expect(
      matchesImageSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        "image/jpeg",
      ),
    ).toBe(true)
    expect(
      matchesImageSignature(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true)
    expect(
      matchesImageSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        "image/png",
      ),
    ).toBe(false)
  })

  it("normalizes bounded draft data", () => {
    const result = normalizeReceiptResult(
      {
        amount: 12_345.4,
        merchantName: `  ${"가".repeat(120)}  `,
        transactionAt: "2026-07-19T12:34:00+09:00",
        paymentLast4: "1234",
        confidence: 2,
        warnings: Array.from({ length: 7 }, (_, index) => `경고 ${index}`),
      },
      "test-model",
      "free",
    )

    expect(result.amount).toBe(12_345)
    expect(result.merchantName).toHaveLength(100)
    expect(result.paymentLast4).toBe("1234")
    expect(result.confidence).toBe(1)
    expect(result.warnings).toHaveLength(5)
  })

  it("rejects an invalid amount or timestamp", () => {
    expect(() =>
      normalizeReceiptResult(
        {
          amount: 0,
          merchantName: "상점",
          transactionAt: "not-a-date",
        },
        "test-model",
        "paid",
      ),
    ).toThrow("invalid receipt result")
  })

  it("recognizes only model-specific daily quota errors", () => {
    expect(
      isModelDailyQuotaError({
        error: {
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                  quotaDimensions: { model: "gemini-3.1-flash-lite" },
                },
              ],
            },
          ],
        },
      }),
    ).toBe(true)
    expect(
      isModelDailyQuotaError({
        error: {
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaId:
                    "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
                  quotaDimensions: { model: "gemini-3.1-flash-lite" },
                },
              ],
            },
          ],
        },
      }),
    ).toBe(false)
  })

  it("uses the configured fallback after the primary model reaches its daily quota", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
    vi.stubEnv("GEMINI_RECEIPT_MODEL", "primary-model")
    vi.stubEnv("GEMINI_RECEIPT_FALLBACK_MODEL", "fallback-model")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "test-user" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 429,
              status: "RESOURCE_EXHAUSTED",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                  violations: [
                    {
                      quotaId:
                        "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                      quotaDimensions: { model: "primary-model" },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        amount: 12_000,
                        merchantName: "테스트 상점",
                        transactionAt: "2026-07-26T12:34:00+09:00",
                        confidence: 0.9,
                        warnings: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST(
      new NextRequest("http://localhost/api/receipts/parse", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "image/jpeg",
          "x-receipt-free-tier-consent": "true",
        },
        body: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
      }),
    )
    const result = (await response.json()) as { model?: string }

    expect(response.status).toBe(200)
    expect(result.model).toBe("fallback-model")
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/models/primary-model:generateContent",
    )
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      "/models/fallback-model:generateContent",
    )
  })
})
