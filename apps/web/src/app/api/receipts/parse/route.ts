import { NextRequest, NextResponse } from "next/server"
import type { ReceiptParseResult } from "@salimon/types"

export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const recentRequests = new Map<string, number[]>()

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.ok) return auth.response

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return errorResponse(
      "영수증 인식 API가 아직 설정되지 않았습니다.",
      503,
    )
  }

  const dataTier = process.env.GEMINI_DATA_TIER === "paid" ? "paid" : "free"
  if (
    dataTier === "free" &&
    request.headers.get("x-receipt-free-tier-consent") !== "true"
  ) {
    return errorResponse(
      "무료 AI 데이터 사용 안내에 동의한 뒤 다시 시도해 주세요.",
      400,
    )
  }

  const rateLimitResponse = enforceRateLimit(auth.userId)
  if (rateLimitResponse) return rateLimitResponse

  const contentType = request.headers.get("content-type")?.split(";")[0] ?? ""
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return errorResponse("JPG, PNG, WEBP 영수증만 인식할 수 있습니다.", 415)
  }

  const image = await request.arrayBuffer()
  if (image.byteLength === 0 || image.byteLength > MAX_IMAGE_BYTES) {
    return errorResponse("영수증 이미지는 8MB 이하로 첨부해 주세요.", 413)
  }
  if (!matchesImageSignature(new Uint8Array(image), contentType)) {
    return errorResponse("파일 내용과 이미지 형식이 일치하지 않습니다.", 415)
  }

  const model = process.env.GEMINI_RECEIPT_MODEL || "gemini-3.1-flash-lite"
  const googleResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "대한민국에서 발행된 결제 영수증 이미지에서 가계부 초안을 추출하세요.",
                  "총 결제금액만 amount에 정수 원 단위로 넣고, 승인·과세·부가세·잔액은 제외하세요.",
                  "merchantName은 실제 상호, transactionAt은 영수증의 결제 일시를 ISO 8601 형식으로 반환하세요.",
                  "categoryHint는 식비, 교통, 생활비, 기타 중 가장 가까운 값으로 정하세요.",
                  "카드 끝 4자리가 명확할 때만 paymentLast4를 반환하세요.",
                  "보이지 않거나 불확실한 내용을 추측하지 말고 warnings에 한국어로 적으세요.",
                  "이 결과는 자동 저장되지 않으며 사용자가 검토할 초안입니다.",
                ].join("\n"),
              },
              {
                inline_data: {
                  mime_type: contentType,
                  data: Buffer.from(image).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: [
              "amount",
              "merchantName",
              "transactionAt",
              "confidence",
              "warnings",
            ],
            properties: {
              amount: { type: "INTEGER", minimum: 0 },
              merchantName: { type: "STRING" },
              transactionAt: { type: "STRING" },
              categoryHint: { type: "STRING" },
              memo: { type: "STRING" },
              paymentLast4: { type: "STRING" },
              confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
              warnings: { type: "ARRAY", items: { type: "STRING" } },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  ).catch(() => null)

  if (!googleResponse) {
    return errorResponse("영수증 인식 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.", 504)
  }
  if (!googleResponse.ok) {
    const retryAfter = googleResponse.headers.get("retry-after")
    const response = errorResponse(
      googleResponse.status === 429
        ? "현재 무료 AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : "영수증을 인식하지 못했습니다. 다른 사진으로 다시 시도해 주세요.",
      googleResponse.status === 429 ? 429 : 502,
    )
    if (retryAfter) response.headers.set("Retry-After", retryAfter)
    return response
  }

  const payload = (await googleResponse.json()) as GeminiResponse
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
  if (!text) return errorResponse("영수증에서 읽을 수 있는 거래 정보를 찾지 못했습니다.", 422)

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const result = normalizeReceiptResult(parsed, model, dataTier)
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return errorResponse("인식 결과를 안전한 가계부 초안으로 변환하지 못했습니다.", 422)
  }
}

async function authenticateRequest(
  request: NextRequest,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !supabaseUrl || !anonKey) {
    return { ok: false, response: errorResponse("로그인이 필요합니다.", 401) }
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null)
  if (!response?.ok) {
    return { ok: false, response: errorResponse("로그인 세션을 다시 확인해 주세요.", 401) }
  }
  const user = (await response.json()) as { id?: unknown }
  if (typeof user.id !== "string") {
    return { ok: false, response: errorResponse("로그인 사용자를 확인하지 못했습니다.", 401) }
  }
  return { ok: true, userId: user.id }
}

function enforceRateLimit(userId: string): NextResponse | null {
  const now = Date.now()
  const windowStart = now - 60_000
  const requests = (recentRequests.get(userId) ?? []).filter(
    (requestedAt) => requestedAt >= windowStart,
  )
  if (requests.length >= 6) {
    const response = errorResponse("영수증 인식은 1분에 6회까지 사용할 수 있습니다.", 429)
    response.headers.set("Retry-After", "60")
    return response
  }
  recentRequests.set(userId, [...requests, now])
  return null
}

export function normalizeReceiptResult(
  parsed: Record<string, unknown>,
  model: string,
  dataTier: "free" | "paid",
): ReceiptParseResult {
  const amount = Math.round(Number(parsed.amount))
  const merchantName = typeof parsed.merchantName === "string" ? parsed.merchantName.trim() : ""
  const transactionAt = typeof parsed.transactionAt === "string" ? parsed.transactionAt : ""
  if (!Number.isSafeInteger(amount) || amount <= 0 || !merchantName || Number.isNaN(Date.parse(transactionAt))) {
    throw new Error("invalid receipt result")
  }
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0))
  return {
    amount,
    merchantName: merchantName.slice(0, 100),
    transactionAt,
    categoryHint: optionalString(parsed.categoryHint, 30),
    memo: optionalString(parsed.memo, 200),
    paymentLast4: /^\d{4}$/.test(String(parsed.paymentLast4 ?? ""))
      ? String(parsed.paymentLast4)
      : undefined,
    confidence,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.slice(0, 120))
          .slice(0, 5)
      : [],
    provider: "gemini",
    model,
    dataTier,
  }
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined
}

export function matchesImageSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return signature.every((value, index) => bytes[index] === value)
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    )
  }
  return false
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}
