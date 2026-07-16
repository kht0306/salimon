import { beforeEach, describe, expect, it, vi } from "vitest"

const { from, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("./supabaseClient", () => ({
  getSupabaseBrowserClient: () => ({ from, rpc }),
}))

import {
  mapPaymentMethodType,
  SupabaseFinanceRepository,
} from "./supabaseFinanceRepository"

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
})

describe("mapPaymentMethodType", () => {
  it("preserves bank accounts instead of mapping every method as a card", () => {
    expect(mapPaymentMethodType("bank")).toBe("bank")
    expect(mapPaymentMethodType("card")).toBe("card")
  })

  it("falls back to card for legacy or unknown values", () => {
    expect(mapPaymentMethodType(undefined)).toBe("card")
  })
})

describe("saveTransaction", () => {
  it("routes every existing transaction through the atomic recurrence RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.saveTransaction("user-1", {
      id: "transaction-1",
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 12000,
      transactionAt: "2026-07-14T03:30:00.000Z",
      recurringType: "fixed",
      paymentMethodId: "card-1",
    })

    expect(rpc).toHaveBeenCalledWith("update_transaction_with_recurrence", {
      p_transaction_id: "transaction-1",
      p_ledger_id: "ledger-1",
      p_amount: 12000,
      p_transaction_at: "2026-07-14T03:30:00.000Z",
      p_category_id: null,
      p_merchant_name: null,
      p_memo: null,
      p_actor_user_id: null,
      p_status: "confirmed",
      p_type: "expense",
      p_payment_method_id: "card-1",
      p_recurring_type: "fixed",
      p_installment_months: null,
      p_installment_amount_type: null,
    })
    expect(from).not.toHaveBeenCalled()
  })
})
