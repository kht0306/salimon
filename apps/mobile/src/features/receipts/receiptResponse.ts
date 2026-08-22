import type { ReceiptParseResult } from "@salimon/types"

export function parseReceiptResult(payload: unknown): ReceiptParseResult {
  if (!isRecord(payload))
    throw new Error("영수증 분석 결과가 올바르지 않습니다.")
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((warning): warning is string =>
        Boolean(typeof warning === "string" && warning.trim()),
      )
    : undefined
  if (
    !Number.isSafeInteger(payload.amount) ||
    Number(payload.amount) <= 0 ||
    typeof payload.merchantName !== "string" ||
    !payload.merchantName.trim() ||
    typeof payload.transactionAt !== "string" ||
    Number.isNaN(new Date(payload.transactionAt).getTime()) ||
    typeof payload.confidence !== "number" ||
    !Number.isFinite(payload.confidence) ||
    payload.confidence < 0 ||
    payload.confidence > 1 ||
    payload.provider !== "gemini" ||
    typeof payload.model !== "string" ||
    (payload.dataTier !== "free" && payload.dataTier !== "paid") ||
    !warnings
  ) {
    throw new Error("영수증 분석 결과가 올바르지 않습니다.")
  }

  return {
    amount: Number(payload.amount),
    merchantName: payload.merchantName.trim(),
    transactionAt: payload.transactionAt,
    categoryHint: optionalString(payload.categoryHint),
    memo: optionalString(payload.memo),
    paymentLast4: optionalString(payload.paymentLast4),
    confidence: payload.confidence,
    warnings,
    provider: "gemini",
    model: payload.model,
    dataTier: payload.dataTier,
  }
}

export function receiptErrorMessage(payload: unknown): string {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : "영수증을 인식하지 못했습니다."
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
