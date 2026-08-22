import type {
  CardNotificationEvent,
  OriginalCurrencyAmount,
  ParsedTransaction,
  TransactionType,
} from "@salimon/types"

const amountPattern =
  /(?:(?:KRW|₩)\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.00)?|(\d{1,3}(?:,\d{3})+|\d+)\s*(?:원|KRW))/i
const foreignAmountPattern =
  /\b([A-Z]{3})\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\b/i
const allAmountPattern =
  /(?:(?:KRW|₩)\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|(?:\d{1,3}(?:,\d{3})+|\d+)\s*(?:원|KRW)|\b[A-Z]{3}\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\b)/gi
const summaryAmountPattern =
  /(?:누적금액|누적|잔액)\s*(?:(?:[A-Z]{3}|₩)\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:원|KRW)?/gi
const datePattern =
  /(?:^|[^\d])((?:0?[1-9]|1[0-2]))[./-]((?:0?[1-9]|[12]\d|3[01]))(?:\s+([01]?\d|2[0-3]):([0-5]\d))?(?!\d)/
const sensitivePatterns = [
  /\b\d{2,4}-\d{3,4}-\d{4}\b/g,
  /\b\d{3,6}-\d{2,6}-\d{2,8}\b/g,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{3,4}\b/g,
  /(승인번호|카드|계좌)\s*[:：]?\s*\d{4,}/gi,
  /\((?=[\d* -]{4,}\))[\d* -]*\d[\d* -]*\)/g,
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
  const transactionText = text.replace(summaryAmountPattern, " ")
  const dateMatch = text.replace(allAmountPattern, " ").match(datePattern)
  const originalCurrencyAmount = extractOriginalCurrencyAmount(transactionText)
  const amount = originalCurrencyAmount ? 0 : extractKrwAmount(transactionText)
  const transactionAt = parseTransactionDate(dateMatch, receivedAt)
  const type = inferType(text)
  const cardNotificationEvent = inferCardNotificationEvent(text)
  const merchantName = extractMerchantName(rawText, text)
  const confidence = scoreConfidence({
    hasAmount: amount > 0 || originalCurrencyAmount !== undefined,
    merchantName,
    hasDate: Boolean(dateMatch),
    type,
  })
  const rawTextMasked = maskSensitiveText(text)

  return {
    type,
    amount,
    currency: "KRW",
    cardNotificationEvent,
    originalCurrencyAmount,
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

function extractKrwAmount(text: string): number {
  const match = text.match(amountPattern)
  const amount = match?.[1] ?? match?.[2]
  return amount ? Number(amount.replace(/,/g, "")) : 0
}

function extractOriginalCurrencyAmount(
  text: string,
): OriginalCurrencyAmount | undefined {
  const match = text.match(foreignAmountPattern)
  const currencyCode = match?.[1]?.toUpperCase()
  const amount = match?.[2]
  if (!currencyCode || !amount || currencyCode === "KRW") return undefined

  const parsedAmount = Number(amount.replace(/,/g, ""))
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return undefined
  return { amount: parsedAmount, currencyCode }
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

function parseTransactionDate(
  match: RegExpMatchArray | null,
  receivedAt: Date,
): Date {
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
  const transactionAt = new Date(
    receivedAt.getFullYear(),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  if (
    transactionAt.getFullYear() !== receivedAt.getFullYear() ||
    transactionAt.getMonth() !== Number(month) - 1 ||
    transactionAt.getDate() !== Number(day) ||
    transactionAt.getHours() !== Number(hour) ||
    transactionAt.getMinutes() !== Number(minute)
  ) {
    return receivedAt
  }

  return transactionAt
}

function inferType(text: string): TransactionType {
  if (/(입금|환급|환불|캐시백|승인취소)/.test(text)) {
    return "income"
  }

  return "expense"
}

function inferCardNotificationEvent(
  text: string,
): CardNotificationEvent | undefined {
  if (/승인\s*취소/.test(text)) return "approval_cancellation"
  return /(?:해외\s*)?승인/.test(text) ? "approval" : undefined
}

function extractMerchantName(
  rawText: string,
  text: string,
): string | undefined {
  const standaloneLine = rawText
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .find(
      (line) =>
        line.length > 1 &&
        line.length <= 50 &&
        !amountPattern.test(line) &&
        !foreignAmountPattern.test(line) &&
        !datePattern.test(line) &&
        !/\((?=[\d* -]{4,}\))[\d* -]*\)/.test(line) &&
        !/(카드|은행|로카|승인|결제|일시불|할부|누적|잔액)/.test(line),
    )
  if (standaloneLine) return standaloneLine

  let scrubbed = text
    .replace(/\[[^\]]+\]/g, " ")
    .replace(datePattern, " ")
    .replace(allAmountPattern, " ")
    .replace(/\S*(?:카드|은행)/gi, " ")
    .replace(/쇼핑엔\s+로카(?:\([^)]*\))?/gi, " ")
    .replace(
      /일시불|할부|체크카드|신용카드|승인취소|승인|결제|사용|출금|입금|이체|환급|환불|캐시백|누적금액|누적|잔액/gi,
      " ",
    )

  const tokens = normalizeWhitespace(scrubbed)
    .split(" ")
    .filter(
      (token) =>
        token.length > 1 && !/^\d+$/.test(token) && !/[()*]/.test(token),
    )

  return tokens.at(0)
}

function scoreConfidence({
  hasAmount,
  merchantName,
  hasDate,
  type,
}: {
  hasAmount: boolean
  merchantName?: string
  hasDate: boolean
  type: TransactionType
}): number {
  let confidence = 0.35
  if (hasAmount) confidence += 0.35
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
