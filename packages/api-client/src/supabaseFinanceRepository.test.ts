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
import type { SalimonSupabaseClient } from "./supabaseClient"

interface QueryResult {
  data: unknown
  error: unknown
}

class LoadQueryDouble implements PromiseLike<QueryResult> {
  readonly select = vi.fn(() => this)
  readonly single = vi.fn(() => Promise.resolve(this.result))
  readonly maybeSingle = vi.fn(() => Promise.resolve(this.result))
  readonly order = vi.fn(() => this)
  readonly limit = vi.fn(() => this)
  readonly range = vi.fn(() => Promise.resolve(this.result))
  readonly is = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly gte = vi.fn(() => this)
  readonly lt = vi.fn(() => this)

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

class MutationQueryDouble implements PromiseLike<QueryResult> {
  readonly abortSignal = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly single = vi.fn(() => this)

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

interface LoadClientDouble {
  client: SalimonSupabaseClient
  from: ReturnType<typeof vi.fn>
  queries: Map<string, LoadQueryDouble>
}

function createLoadClientDouble(
  overrides: Record<string, QueryResult> = {},
): LoadClientDouble {
  const queries = new Map<string, LoadQueryDouble>()
  const clientFrom = vi.fn((table: string) => {
    const result = overrides[table] ?? defaultLoadResult(table)
    const query = new LoadQueryDouble(result)
    queries.set(table, query)
    return query
  })

  return {
    client: { from: clientFrom } as unknown as SalimonSupabaseClient,
    from: clientFrom,
    queries,
  }
}

function defaultLoadResult(table: string): QueryResult {
  if (table === "profiles") {
    return {
      data: {
        id: "user-1",
        nickname: "테스트 사용자",
        default_currency: "KRW",
        timezone: "Asia/Seoul",
      },
      error: null,
    }
  }

  if (table === "transactions") {
    return {
      data: [
        {
          id: "transaction-1",
          ledger_id: "ledger-1",
          type: "expense",
          status: "confirmed",
          amount: 12000,
          currency: "KRW",
          transaction_at: "2026-08-10T03:00:00.000Z",
        },
      ],
      error: null,
    }
  }

  if (table === "transaction_splits") {
    return {
      data: [
        {
          id: "split-1",
          transaction_id: "transaction-1",
          category_id: "category-1",
          amount: 12000,
          sort_order: 0,
        },
      ],
      error: null,
    }
  }

  if (table === "account_deletion_requests" || table === "legal_consents") {
    return { data: null, error: null }
  }

  return { data: [], error: null }
}

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
})

describe("load", () => {
  it("uses an injected client and limits transactions and splits to the requested month", async () => {
    const { client, from: injectedFrom, queries } = createLoadClientDouble()
    const repository = new SupabaseFinanceRepository(client)

    const data = await repository.load("user-1", {
      transactionDateRange: {
        start: "2026-08-01T00:00:00+09:00",
        endExclusive: "2026-09-01T00:00:00+09:00",
      },
    })

    expect(injectedFrom).toHaveBeenCalledWith("transactions")
    expect(from).not.toHaveBeenCalled()
    expect(queries.get("transactions")?.gte).toHaveBeenCalledWith(
      "transaction_at",
      "2026-08-01T00:00:00+09:00",
    )
    expect(queries.get("transactions")?.lt).toHaveBeenCalledWith(
      "transaction_at",
      "2026-09-01T00:00:00+09:00",
    )
    expect(queries.get("transaction_splits")?.in).toHaveBeenCalledWith(
      "transaction_id",
      ["transaction-1"],
    )
    expect(data.transactions).toHaveLength(1)
    expect(data.transactionSplits).toHaveLength(1)
  })

  it("surfaces an injected transaction query error", async () => {
    const { client } = createLoadClientDouble({
      transactions: {
        data: null,
        error: { message: "월 거래 조회에 실패했습니다." },
      },
    })
    const repository = new SupabaseFinanceRepository(client)

    await expect(
      repository.load("user-1", {
        transactionDateRange: {
          start: "2026-08-01T00:00:00+09:00",
          endExclusive: "2026-09-01T00:00:00+09:00",
        },
      }),
    ).rejects.toThrow("월 거래 조회에 실패했습니다.")
  })

  it("rejects an invalid range before sending a query", async () => {
    const { client, from: injectedFrom } = createLoadClientDouble()
    const repository = new SupabaseFinanceRepository(client)

    await expect(
      repository.load("user-1", {
        transactionDateRange: {
          start: "2026-09-01T00:00:00+09:00",
          endExclusive: "2026-08-01T00:00:00+09:00",
        },
      }),
    ).rejects.toThrow("거래 조회 기간이 올바르지 않습니다.")
    expect(injectedFrom).not.toHaveBeenCalled()
  })
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
  it("passes the abort signal to a new transaction request", async () => {
    const query = new MutationQueryDouble({
      data: { id: "transaction-1" },
      error: null,
    })
    const clientFrom = vi.fn(() => query)
    const repository = new SupabaseFinanceRepository({
      from: clientFrom,
    } as unknown as SalimonSupabaseClient)
    const abortController = new AbortController()

    await repository.saveTransaction(
      "user-1",
      {
        ledgerId: "ledger-1",
        type: "expense",
        status: "confirmed",
        amount: 12_000,
        transactionAt: "2026-08-12T20:30:00+09:00",
      },
      { signal: abortController.signal },
    )

    expect(clientFrom).toHaveBeenCalledWith("transactions")
    expect(query.abortSignal).toHaveBeenCalledWith(abortController.signal)
  })

  it("creates new installments with the purchase-first schedule RPC", async () => {
    rpc.mockResolvedValue({ data: "rule-1", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.saveTransaction("user-1", {
      ledgerId: "ledger-1",
      type: "expense",
      status: "confirmed",
      amount: 300000,
      transactionAt: "2026-07-24T07:30:00.000Z",
      recurringType: "installment",
      installmentMonths: 3,
      installmentAmountType: "principal",
      paymentMethodId: "card-1",
    })

    expect(rpc).toHaveBeenCalledWith("save_card_installment_series_v3", {
      p_rule_id: null,
      p_ledger_id: "ledger-1",
      p_amount: 300000,
      p_amount_type: "principal",
      p_transaction_at: "2026-07-24T07:30:00.000Z",
      p_installment_months: 3,
      p_category_id: null,
      p_merchant_name: null,
      p_memo: null,
      p_actor_user_id: null,
      p_status: "confirmed",
      p_type: "expense",
      p_payment_method_id: "card-1",
    })
  })

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

    expect(rpc).toHaveBeenCalledWith("update_transaction_with_recurrence_v3", {
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
      p_income_kind: null,
      p_payment_method_id: "card-1",
      p_recurring_type: "fixed",
      p_installment_months: null,
      p_installment_amount_type: null,
      p_apply_changes_to_future: true,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it.each(["fixed", "installment"] as const)(
    "uses the transaction id when clearing splits after a %s edit",
    async (recurringType) => {
      rpc
        .mockResolvedValueOnce({ data: "rule-1", error: null })
        .mockResolvedValueOnce({ data: null, error: null })
      const repository = new SupabaseFinanceRepository()

      await repository.saveTransaction("user-1", {
        id: "transaction-1",
        ledgerId: "ledger-1",
        type: "expense",
        status: "confirmed",
        amount: 12000,
        transactionAt: "2026-07-14T03:30:00.000Z",
        recurringType,
        recurringRuleId: "rule-1",
        splits: [],
      })

      expect(rpc).toHaveBeenNthCalledWith(2, "replace_transaction_splits", {
        p_transaction_id: "transaction-1",
        p_splits: [],
      })
    },
  )

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
      applyChangesToFuture: false,
    })

    expect(rpc).toHaveBeenCalledWith(
      "update_transaction_with_recurrence_v3",
      expect.objectContaining({ p_apply_changes_to_future: false }),
    )
  })

  it("passes salary classification with the fixed-income edit", async () => {
    rpc.mockResolvedValue({ data: "rule-1", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.saveTransaction("user-1", {
      id: "transaction-1",
      ledgerId: "ledger-1",
      type: "income",
      incomeKind: "salary",
      status: "confirmed",
      amount: 3000000,
      transactionAt: "2026-07-25T03:00:00.000Z",
      recurringType: "fixed",
    })

    expect(rpc).toHaveBeenCalledWith(
      "update_transaction_with_recurrence_v3",
      expect.objectContaining({
        p_type: "income",
        p_income_kind: "salary",
        p_recurring_type: "fixed",
      }),
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

describe("deleteInstallmentOccurrences", () => {
  it("passes the selected occurrence and deletion scope atomically", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.deleteInstallmentOccurrences(
      "rule-1",
      3,
      "current_and_future",
    )

    expect(rpc).toHaveBeenCalledWith("delete_installment_occurrences", {
      p_rule_id: "rule-1",
      p_installment_number: 3,
      p_scope: "current_and_future",
    })
    expect(from).not.toHaveBeenCalled()
  })
})

describe("category hierarchy mutations", () => {
  it("creates a category and its usage types atomically", async () => {
    rpc.mockResolvedValue({ data: "category-2", error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.createCategory({
      ledgerId: "ledger-1",
      name: "한식",
      icon: "utensils",
      color: "#2d6a4f",
      usageTypes: ["expense"],
      parentCategoryId: "category-1",
    })

    expect(rpc).toHaveBeenCalledWith("create_category_v2", {
      p_ledger_id: "ledger-1",
      p_name: "한식",
      p_icon: "utensils",
      p_color: "#2d6a4f",
      p_usage_types: ["expense"],
      p_parent_category_id: "category-1",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("updates category presentation, usage, and parent atomically", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.updateCategory("category-2", {
      name: "집밥",
      icon: "home",
      color: "#277da1",
      usageTypes: ["expense"],
      parentCategoryId: "category-1",
    })

    expect(rpc).toHaveBeenCalledWith("update_category_v2", {
      p_category_id: "category-2",
      p_name: "집밥",
      p_icon: "home",
      p_color: "#277da1",
      p_usage_types: ["expense"],
      p_parent_category_id: "category-1",
    })
  })

  it("reorders only categories with the same parent", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const repository = new SupabaseFinanceRepository()

    await repository.updateCategoryOrder("category-1", [
      "category-3",
      "category-2",
    ])

    expect(rpc).toHaveBeenCalledWith("reorder_category_siblings", {
      p_parent_category_id: "category-1",
      p_category_ids: ["category-3", "category-2"],
    })
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
    expect(rpc).toHaveBeenCalledWith("accept_ledger_invite_and_set_default", {
      submitted_code: "ABCDEFGH",
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
