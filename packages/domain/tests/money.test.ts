import { describe, expect, it } from "vitest"
import { splitInstallmentPrincipal } from "../src/money"

describe("splitInstallmentPrincipal", () => {
  it("adds a non-divisible remainder to the final installment", () => {
    expect(splitInstallmentPrincipal(100_000, 3)).toEqual([
      33_333, 33_333, 33_334,
    ])
  })

  it("keeps evenly divisible installments equal", () => {
    expect(splitInstallmentPrincipal(120_000, 3)).toEqual([
      40_000, 40_000, 40_000,
    ])
  })

  it("rejects installments that would contain a zero amount", () => {
    expect(splitInstallmentPrincipal(1, 3)).toEqual([])
  })
})
