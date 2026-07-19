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

    expect(rpc).toHaveBeenCalledWith("update_transaction_with_recurrence_v2", {
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
      p_apply_amount_to_future: true,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("passes a current-month-only recurring amount scope", async () => {
    rpc.mockResolvedValue({ data: "rule-1", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.saveTransaction("user-1", {
      id: "transaction-1",
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 15000,
      transactionAt: "2026-07-14T03:30:00.000Z",
      recurringType: "fixed",
      applyAmountToFuture: false,
    })

    expect(rpc).toHaveBeenCalledWith(
      "update_transaction_with_recurrence_v2",
      expect.objectContaining({ p_apply_amount_to_future: false }),
    )
  })
})

describe("deactivateFixedRule", () => {
  it("deactivates the rule and its transactions from the selected month", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.deactivateFixedRule("rule-1", "2026-07")

    expect(rpc).toHaveBeenCalledWith("deactivate_fixed_rule_from_month", {
      p_rule_id: "rule-1",
      p_month: "2026-07-01",
    })
    expect(from).not.toHaveBeenCalled()
  })
})

describe("createLedger", () => {
  it("passes selected instruments and shared visibility separately", async () => {
    rpc.mockResolvedValue({ data: "ledger-2", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.createLedger({
      name: "여행 가계부",
      type: "shared",
      setDefault: false,
      paymentInstrumentIds: ["instrument-1", "instrument-2"],
      ledgerVisibleInstrumentIds: ["instrument-2"],
    })

    expect(rpc).toHaveBeenCalledWith("create_ledger", {
      p_name: "여행 가계부",
      p_type: "shared",
      p_set_default: false,
      p_payment_instrument_ids: ["instrument-1", "instrument-2"],
      p_ledger_visible_instrument_ids: ["instrument-2"],
    })
  })
})

describe("setDefaultLedger", () => {
  it("uses the atomic default-ledger RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.setDefaultLedger("ledger-2")

    expect(rpc).toHaveBeenCalledWith("set_default_ledger", {
      p_ledger_id: "ledger-2",
    })
  })
})

describe("convertPersonalLedgerToShared", () => {
  it("keeps every payment-instrument link private during conversion", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.convertPersonalLedgerToShared("ledger-1")

    expect(rpc).toHaveBeenCalledWith("convert_personal_ledger_to_shared", {
      p_ledger_id: "ledger-1",
      p_shared_payment_method_ids: [],
    })
  })
})

describe("acceptInvite", () => {
  it("returns a structured already-member result", async () => {
    rpc.mockResolvedValue({
      data: { status: "already_member", ledgerId: "ledger-2" },
      error: null,
    })
    const repository = new SupabaseFinanceRepository()

    await expect(repository.acceptInvite("ABCDEFGH")).resolves.toEqual({
      status: "already_member",
      ledgerId: "ledger-2",
    })
  })

  it("keeps invalid and expired codes indistinguishable", async () => {
    rpc.mockResolvedValue({
      data: { status: "invalid_or_expired" },
      error: null,
    })
    const repository = new SupabaseFinanceRepository()

    await expect(repository.acceptInvite("ABCDEFGH")).resolves.toEqual({
      status: "invalid_or_expired",
    })
  })
})

describe("syncMyLedgerPaymentMethods", () => {
  it("passes connected, shared, and primary instruments separately", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.syncMyLedgerPaymentMethods(
      "ledger-2",
      ["instrument-1", "instrument-2"],
      ["instrument-2"],
      "instrument-1",
    )

    expect(rpc).toHaveBeenCalledWith("sync_my_ledger_payment_methods", {
      p_ledger_id: "ledger-2",
      p_payment_instrument_ids: ["instrument-1", "instrument-2"],
      p_ledger_visible_instrument_ids: ["instrument-2"],
      p_primary_instrument_id: "instrument-1",
    })
  })
})

describe("independent payment instruments", () => {
  it("creates a card without a ledger id", async () => {
    rpc.mockResolvedValue({ data: "instrument-1", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.createCard({
      name: "생활비 카드",
      issuer: "신한카드",
      last4: "1234",
      paymentDay: 14,
      billingPeriodEndDay: 31,
      billingPeriodEndMonthOffset: -1,
      isDebit: false,
    })

    expect(rpc).toHaveBeenCalledWith("create_user_payment_instrument", {
      p_type: "card",
      p_name: "생활비 카드",
      p_last4: "1234",
      p_issuer: "신한카드",
      p_payment_day: 14,
      p_billing_period_end_day: 31,
      p_billing_period_end_month_offset: -1,
      p_is_debit: false,
    })
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_ledger_id")
  })

  it("creates an account without a ledger id", async () => {
    rpc.mockResolvedValue({ data: "instrument-2", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.createAccount({
      name: "급여 계좌",
      bank: "국민은행",
      last4: "5678",
    })

    expect(rpc).toHaveBeenCalledWith("create_user_payment_instrument", {
      p_type: "bank",
      p_name: "급여 계좌",
      p_last4: "5678",
      p_issuer: "국민은행",
      p_payment_day: null,
      p_billing_period_end_day: null,
      p_billing_period_end_month_offset: null,
      p_is_debit: false,
    })
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_ledger_id")
  })
})
