import {
  createEmptyFinanceData,
  type RemoteTransactionInput,
  type SupabaseFinanceRepository,
  type TransactionData,
} from "@salimon/api-client"
import { AppStore, type TransactionDraft } from "@salimon/store"
import { afterEach, describe, expect, it, vi } from "vitest"

const draft: TransactionDraft = {
  ledgerId: "ledger-1",
  type: "expense",
  status: "confirmed",
  amount: 35_000,
  transactionAt: "2026-08-22T22:04",
  categoryId: "category-1",
}

function createReadyStore(
  repository: Partial<SupabaseFinanceRepository>,
): AppStore {
  const store = new AppStore(repository as SupabaseFinanceRepository)
  const data = createEmptyFinanceData()
  data.profile = {
    id: "user-1",
    nickname: "사용자",
    defaultCurrency: "KRW",
    timezone: "Asia/Seoul",
  }
  data.ledgers = [
    {
      id: "ledger-1",
      ownerId: "user-1",
      name: "우리집",
      type: "personal",
      currency: "KRW",
      role: "owner",
    },
  ]
  data.members = [
    {
      id: "member-1",
      ledgerId: "ledger-1",
      userId: "user-1",
      nickname: "사용자",
      role: "owner",
      status: "active",
      isDefault: true,
      joinedAt: "2026-08-01T00:00:00.000Z",
    },
  ]
  store.authUser = { id: "user-1", nickname: "사용자" }
  store.hydrate(data)
  store.dataState = "ready"
  return store
}

afterEach(() => {
  vi.useRealTimers()
})

describe("AppStore transaction saves", () => {
  it("finishes after the database write without waiting for the background refresh", async () => {
    const repository = {
      saveTransaction: vi.fn(async () => "transaction-1"),
      materializeMonth: vi.fn(async () => undefined),
      loadTransactions: vi.fn(
        () => new Promise<TransactionData>(() => undefined),
      ),
    }
    const store = createReadyStore(repository)

    await expect(store.saveTransaction(draft)).resolves.toBe(true)

    expect(store.transactionMutationState).toBe("idle")
    expect(store.data.transactions[0]?.id).toBe("transaction-1")
    await vi.waitFor(() =>
      expect(repository.loadTransactions).toHaveBeenCalled(),
    )
  })

  it("confirms a completed request after the original response times out", async () => {
    vi.useFakeTimers()
    let submittedInput: RemoteTransactionInput | undefined
    const repository = {
      saveTransaction: vi.fn(
        (
          _userId: string,
          input: RemoteTransactionInput,
          options?: { signal?: AbortSignal },
        ) => {
          submittedInput = input
          return new Promise<string>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            )
          })
        },
      ),
      findTransactionRequest: vi.fn(async (requestId: string) => ({
        transactionId: requestId,
      })),
      materializeMonth: vi.fn(async () => undefined),
      loadTransactions: vi.fn(
        async (): Promise<TransactionData> => ({
          transactions: [],
          transactionSplits: [],
        }),
      ),
    }
    const store = createReadyStore(repository)

    const save = store.saveTransaction(draft)
    await vi.advanceTimersByTimeAsync(15_000)

    await expect(save).resolves.toBe(true)
    expect(repository.findTransactionRequest).toHaveBeenCalledWith(
      submittedInput?.requestId,
    )
    expect(store.transactionMutationState).toBe("idle")
  })
})
