import { describe, expect, it } from "vitest"
import { buildInstallmentSchedulePreview } from "./installmentSchedule"

describe("buildInstallmentSchedulePreview", () => {
  it("uses the purchase date first and the card payment day from next month", () => {
    expect(
      buildInstallmentSchedulePreview({
        purchaseDate: "2026-07-24",
        paymentDay: 25,
        installmentMonths: 3,
      }),
    ).toEqual([
      { installmentNumber: 1, date: "2026-07-24" },
      { installmentNumber: 2, date: "2026-08-25" },
      { installmentNumber: 3, date: "2026-09-25" },
    ])
  })

  it("caps payment days at the end of shorter months", () => {
    expect(
      buildInstallmentSchedulePreview({
        purchaseDate: "2026-01-31",
        paymentDay: 31,
        installmentMonths: 3,
      }),
    ).toEqual([
      { installmentNumber: 1, date: "2026-01-31" },
      { installmentNumber: 2, date: "2026-02-28" },
      { installmentNumber: 3, date: "2026-03-31" },
    ])
  })

  it("uses February 29 in a leap year", () => {
    expect(
      buildInstallmentSchedulePreview({
        purchaseDate: "2028-01-30",
        paymentDay: 31,
        installmentMonths: 2,
      }),
    ).toEqual([
      { installmentNumber: 1, date: "2028-01-30" },
      { installmentNumber: 2, date: "2028-02-29" },
    ])
  })
})
