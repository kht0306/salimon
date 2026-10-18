export interface InstallmentSchedulePreviewItem {
  installmentNumber: number
  date: string
}

export interface InstallmentSchedulePreviewInput {
  purchaseDate: string
  paymentDay?: number
  installmentMonths: number
  // Existing transaction conversions retain the legacy card billing cycle.
  billingCycle?: {
    endDay?: number
    endMonthOffset?: -1 | 0
  }
}

export function buildInstallmentSchedulePreview(
  input: InstallmentSchedulePreviewInput,
): InstallmentSchedulePreviewItem[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.purchaseDate)
  const paymentDay = input.paymentDay
  if (
    !match ||
    typeof paymentDay !== "number" ||
    !Number.isSafeInteger(paymentDay) ||
    paymentDay < 1 ||
    paymentDay > 31 ||
    !Number.isSafeInteger(input.installmentMonths) ||
    input.installmentMonths < 2 ||
    input.installmentMonths > 120
  ) {
    return []
  }

  const purchaseYear = Number(match[1])
  const purchaseMonth = Number(match[2])
  const purchaseDay = Number(match[3])
  const purchase = new Date(purchaseYear, purchaseMonth - 1, purchaseDay)
  if (
    purchase.getFullYear() !== purchaseYear ||
    purchase.getMonth() !== purchaseMonth - 1 ||
    purchase.getDate() !== purchaseDay
  ) {
    return []
  }

  let firstMonth = new Date(purchaseYear, purchaseMonth - 1, 1)
  let occurrenceDay = paymentDay
  if (input.billingCycle) {
    const { endDay, endMonthOffset } = input.billingCycle
    if (
      typeof endDay !== "number" ||
      !Number.isSafeInteger(endDay) ||
      endDay < 1 ||
      endDay > 31 ||
      (endMonthOffset !== -1 && endMonthOffset !== 0)
    ) {
      return []
    }
    const cutoffMonth = new Date(
      purchaseYear,
      purchaseMonth - 1 + endMonthOffset,
      1,
    )
    const cutoffLastDay = new Date(
      cutoffMonth.getFullYear(),
      cutoffMonth.getMonth() + 1,
      0,
    ).getDate()
    const cutoffDate = new Date(
      cutoffMonth.getFullYear(),
      cutoffMonth.getMonth(),
      Math.min(endDay, cutoffLastDay),
    )
    if (purchase > cutoffDate)
      firstMonth = new Date(purchaseYear, purchaseMonth, 1)
    const firstMonthLastDay = new Date(
      firstMonth.getFullYear(),
      firstMonth.getMonth() + 1,
      0,
    ).getDate()
    occurrenceDay = Math.min(paymentDay, firstMonthLastDay)
  }

  return Array.from({ length: input.installmentMonths }, (_, index) => {
    if (index === 0 && !input.billingCycle) {
      return { installmentNumber: 1, date: input.purchaseDate }
    }

    const targetMonth = new Date(
      firstMonth.getFullYear(),
      firstMonth.getMonth() + index,
      1,
    )
    const lastDay = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate()
    const day = Math.min(occurrenceDay, lastDay)

    return {
      installmentNumber: index + 1,
      date: formatDate(
        targetMonth.getFullYear(),
        targetMonth.getMonth() + 1,
        day,
      ),
    }
  })
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
