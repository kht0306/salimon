export function formatKrw(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function parseMoneyInput(value: string): number {
  const normalized = value.replace(/[^\d.-]/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoneyInput(value: string | number): string {
  const digits = String(value).replace(/\D/g, "")
  return digits ? Number(digits).toLocaleString("ko-KR") : ""
}

export function splitInstallmentPrincipal(
  principal: number,
  months: number,
): number[] {
  if (
    !Number.isSafeInteger(principal) ||
    !Number.isSafeInteger(months) ||
    principal <= 0 ||
    months < 2 ||
    principal < months
  ) {
    return []
  }

  const monthlyAmount = Math.floor(principal / months)
  return Array.from({ length: months }, (_, index) =>
    index === months - 1
      ? principal - monthlyAmount * (months - 1)
      : monthlyAmount,
  )
}
