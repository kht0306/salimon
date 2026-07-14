import type { ParsedTransaction, TransactionType } from "@salimon/types"

const amountPattern = /(\d{1,3}(?:,\d{3})+|\d+)\s*(?:원|KRW)/i
const datePattern = /(\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/
const sensitivePatterns = [
  /\b\d{2,4}-\d{3,4}-\d{4}\b/g,
  /\b\d{3,6}-\d{2,6}-\d{2,8}\b/g,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{3,4}\b/g,
  /(승인번호|승인|카드|계좌)\s*[:：]?\s*\d{4,}/gi,
]

export function parseCardSmsText(
  rawText: string,
  receivedAt = new Date(),
  options: {
    sourceApp?: string
    sourceSender?: string
    targetLedgerId?: string
  } = {},
): ParsedTransaction {
  const text = normalizeWhitespace(rawText)
  const amountMatch = text.match(amountPattern)
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0
  const transactionAt = parseTransactionDate(text, receivedAt)
  const type = inferType(text)
  const merchantName = extractMerchantName(text, amountMatch?.[0])
  const confidence = scoreConfidence({
    amount,
    merchantName,
    hasDate: Boolean(text.match(datePattern)),
    type,
  })
  const rawTextMasked = maskSensitiveText(text)

  return {
    type,
    amount,
    currency: "KRW",
    transactionAt: transactionAt.toISOString(),
    merchantName,
    targetLedgerId: options.targetLedgerId,
    sourceApp: options.sourceApp,
    sourceSender: options.sourceSender,
    confidence,
    normalizedHash: createNormalizedHash([
      options.sourceApp,
      options.sourceSender,
      String(amount),
      transactionAt.toISOString().slice(0, 16),
      merchantName,
      rawTextMasked,
    ]),
    rawTextMasked,
  }
}

export function maskSensitiveText(value: string): string {
  return sensitivePatterns.reduce(
    (result, pattern) => result.replace(pattern, maskMatch),
    value,
  )
}

export function createNormalizedHash(
  parts: Array<string | number | undefined>,
): string {
  const normalized = parts
    .filter(
      (part): part is string | number => part !== undefined && part !== "",
    )
    .map((part) => String(part).trim().toLowerCase())
    .join("|")

  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `sms_${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function parseTransactionDate(text: string, receivedAt: Date): Date {
  const match = text.match(datePattern)
  if (!match) {
    return receivedAt
  }

  const [
    ,
    month,
    day,
    hour = String(receivedAt.getHours()),
    minute = String(receivedAt.getMinutes()),
  ] = match
  return new Date(
    receivedAt.getFullYear(),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
}

function inferType(text: string): TransactionType {
  if (/(입금|환급|캐시백)/.test(text)) {
    return "income"
  }

  return "expense"
}

function extractMerchantName(
  text: string,
  amountToken?: string,
): string | undefined {
  let scrubbed = text
    .replace(/\[[^\]]+\]/g, " ")
    .replace(datePattern, " ")
    .replace(
      /일시불|체크카드|신용카드|승인취소|승인|결제|사용|출금|입금|환급|캐시백|누적|잔액/gi,
      " ",
    )

  if (amountToken) {
    scrubbed = scrubbed.replace(amountToken, " ")
  }

  const tokens = normalizeWhitespace(scrubbed)
    .split(" ")
    .filter((token) => token.length > 1 && !/^\d+$/.test(token))

  return tokens.at(-1)
}

function scoreConfidence({
  amount,
  merchantName,
  hasDate,
  type,
}: {
  amount: number
  merchantName?: string
  hasDate: boolean
  type: TransactionType
}): number {
  let confidence = 0.35
  if (amount > 0) confidence += 0.35
  if (merchantName) confidence += 0.2
  if (hasDate) confidence += 0.08
  if (type === "expense") confidence += 0.02
  return Math.min(Number(confidence.toFixed(4)), 0.99)
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function maskMatch(value: string): string {
  const labelMatch = value.match(/^(승인번호|승인|카드|계좌)/i)
  return labelMatch ? `${labelMatch[0]} ****` : "****"
}
