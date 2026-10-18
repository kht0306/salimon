import type { ReactNode } from "react"
import { renderTestElement } from "../../test/renderTestElement"
import type { PaymentMethod } from "@salimon/types"
import { describe, expect, it, vi } from "vitest"
import { InstallmentSchedulePreview } from "./InstallmentSchedulePreview"

vi.mock("@emotion/native", async () => {
  const { createElement } = await import("react")
  const styled =
    () =>
    ({ children }: { children?: ReactNode }) =>
      createElement("div", null, children)
  return { default: new Proxy(styled, { get: () => styled }) }
})
vi.mock("../../components/AppText", () => ({ AppText: "span" }))

const card: PaymentMethod = {
  id: "card",
  instrumentId: "instrument",
  ledgerId: "ledger",
  name: "테스트 카드",
  type: "card",
  visibility: "ledger",
  isActive: true,
  paymentDay: 31,
  billingPeriodEndDay: 20,
  billingPeriodEndMonthOffset: 0,
}

describe("installment schedule preview", () => {
  it("updates the preview when the purchase date, card, or month count changes", () => {
    const first = renderTestElement(
      <InstallmentSchedulePreview
        installmentMonths="3"
        paymentMethod={card}
        purchaseDate="2028-01-30"
      />,
    )
    expect(first).toContain("2028년 2월 29일")
    const changed = renderTestElement(
      <InstallmentSchedulePreview
        installmentMonths="6"
        paymentMethod={{ ...card, paymentDay: 15 }}
        purchaseDate="2028-02-29"
      />,
    )
    expect(changed).toContain("2028년 2월 29일")
    expect(changed).toContain("2028년 3월 15일")
    expect(changed).toContain("2028년 7월 15일")
    expect(changed).toContain("6/6회")
    expect(changed).toContain("중간 회차 생략")
    expect(changed).not.toContain("4/6회")
  })

  it("previews the actual billing cycle when converting an existing transaction", () => {
    const markup = renderTestElement(
      <InstallmentSchedulePreview
        installmentMonths="3"
        isConversion
        paymentMethod={card}
        purchaseDate="2026-01-31"
      />,
    )
    expect(markup).toContain("2026년 2월 28일")
    expect(markup).toContain("2026년 3월 28일")
    expect(markup).not.toContain("2026년 1월 31일")
  })

  it("does not show an invented schedule without a card payment day", () => {
    expect(
      renderTestElement(
        <InstallmentSchedulePreview
          installmentMonths="3"
          paymentMethod={{ ...card, paymentDay: undefined }}
          purchaseDate="2026-01-31"
        />,
      ),
    ).toBe("")
  })
})
