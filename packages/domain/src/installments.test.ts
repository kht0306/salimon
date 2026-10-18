import { describe, expect, it } from "vitest"
import {
  buildInstallmentSchedulePreview,
  type InstallmentSchedulePreviewInput,
} from "./installments"

describe("buildInstallmentSchedulePreview", () => {
  it.each<InstallmentSchedulePreviewInput>([
    { purchaseDate: "2026-02-30", paymentDay: 25, installmentMonths: 3 },
    { purchaseDate: "invalid", paymentDay: 25, installmentMonths: 3 },
    { purchaseDate: "2026-01-01", installmentMonths: 3 },
    { purchaseDate: "2026-01-01", paymentDay: 0, installmentMonths: 3 },
    { purchaseDate: "2026-01-01", paymentDay: 32, installmentMonths: 3 },
    { purchaseDate: "2026-01-01", paymentDay: 25, installmentMonths: 1 },
    { purchaseDate: "2026-01-01", paymentDay: 25, installmentMonths: 121 },
    { purchaseDate: "2026-01-01", paymentDay: 25, installmentMonths: 2.5 },
    {
      purchaseDate: "2026-01-01",
      paymentDay: 25,
      installmentMonths: 3,
      billingCycle: {},
    },
    {
      purchaseDate: "2026-01-01",
      paymentDay: 25,
      installmentMonths: 3,
      billingCycle: { endDay: 32, endMonthOffset: 0 },
    },
  ])(
    "does not preview invalid or incomplete installment settings: %j",
    (input) => {
      expect(buildInstallmentSchedulePreview(input)).toEqual([])
    },
  )

  it.each([
    {
      purchaseDate: "2026-01-20",
      endMonthOffset: 0 as const,
      dates: ["2026-01-25", "2026-02-25", "2026-03-25"],
    },
    {
      purchaseDate: "2026-01-21",
      endMonthOffset: 0 as const,
      dates: ["2026-02-25", "2026-03-25", "2026-04-25"],
    },
    {
      purchaseDate: "2026-01-01",
      endMonthOffset: -1 as const,
      dates: ["2026-02-25", "2026-03-25", "2026-04-25"],
    },
  ])(
    "matches the existing billing cycle conversion for $purchaseDate / $endMonthOffset",
    ({ purchaseDate, endMonthOffset, dates }) => {
      expect(
        buildInstallmentSchedulePreview({
          purchaseDate,
          paymentDay: 25,
          installmentMonths: 3,
          billingCycle: { endDay: 20, endMonthOffset },
        }).map((item) => item.date),
      ).toEqual(dates)
    },
  )

  it("preserves the first billing day's end-of-month cap for legacy conversions", () => {
    expect(
      buildInstallmentSchedulePreview({
        purchaseDate: "2026-01-31",
        paymentDay: 31,
        installmentMonths: 2,
        billingCycle: { endDay: 20, endMonthOffset: 0 },
      }),
    ).toEqual([
      { installmentNumber: 1, date: "2026-02-28" },
      { installmentNumber: 2, date: "2026-03-28" },
    ])
  })

  it("crosses the year boundary and uses leap day in the purchase schedule", () => {
    expect(
      buildInstallmentSchedulePreview({
        purchaseDate: "2027-12-30",
        paymentDay: 31,
        installmentMonths: 3,
      }).map((item) => item.date),
    ).toEqual(["2027-12-30", "2028-01-31", "2028-02-29"])
  })

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
