import { describe, expect, it } from "vitest"
import { mapPaymentMethodType } from "./supabaseFinanceRepository"

describe("mapPaymentMethodType", () => {
  it("preserves bank accounts instead of mapping every method as a card", () => {
    expect(mapPaymentMethodType("bank")).toBe("bank")
    expect(mapPaymentMethodType("card")).toBe("card")
  })

  it("falls back to card for legacy or unknown values", () => {
    expect(mapPaymentMethodType(undefined)).toBe("card")
  })
})
