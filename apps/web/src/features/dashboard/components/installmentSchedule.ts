export interface InstallmentSchedulePreviewItem {
  installmentNumber: number
  date: string
}

export function buildInstallmentSchedulePreview(input: {
  purchaseDate: string
  paymentDay?: number
  installmentMonths: number
}): InstallmentSchedulePreviewItem[] {
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

  return Array.from({ length: input.installmentMonths }, (_, index) => {
    if (index === 0) {
      return { installmentNumber: 1, date: input.purchaseDate }
    }

    const targetMonth = new Date(purchaseYear, purchaseMonth - 1 + index, 1)
    const lastDay = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate()
    const day = Math.min(paymentDay, lastDay)

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
