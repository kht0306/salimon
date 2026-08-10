import {
  createEmptyFinanceData,
  SupabaseFinanceRepository,
  type FinanceData,
  type FinanceLoadOptions,
  type TransactionDateRange,
} from "@salimon/api-client"
import { toMonthKey } from "@salimon/domain"
import { makeAutoObservable, runInAction } from "mobx"
import { requireSupabaseMobileClient } from "../infrastructure/supabase"

type MobileFinanceRepository = Pick<SupabaseFinanceRepository, "load">

export type MobileDataStatus = "idle" | "loading" | "ready" | "error"

export class MobileAppStore {
  selectedMonth: string
  financeData: FinanceData = createEmptyFinanceData()
  dataStatus: MobileDataStatus = "idle"
  errorMessage?: string

  constructor(
    private readonly repository: MobileFinanceRepository,
    now = new Date(),
  ) {
    this.selectedMonth = toMonthKey(now)
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async loadSelectedMonth(
    userId: string,
    month = this.selectedMonth,
  ): Promise<void> {
    const options: FinanceLoadOptions = {
      transactionDateRange: createKoreaMonthTransactionRange(month),
    }

    this.selectedMonth = month
    this.dataStatus = "loading"
    this.errorMessage = undefined

    try {
      const financeData = await this.repository.load(userId, options)
      runInAction(() => {
        this.financeData = financeData
        this.dataStatus = "ready"
      })
    } catch (error) {
      runInAction(() => {
        this.dataStatus = "error"
        this.errorMessage =
          error instanceof Error
            ? error.message
            : "가계부 데이터를 불러오지 못했습니다."
      })
      throw error
    }
  }
}

export function createMobileAppStore(now = new Date()): MobileAppStore {
  const repository = new SupabaseFinanceRepository(
    requireSupabaseMobileClient(),
  )
  return new MobileAppStore(repository, now)
}

export function createKoreaMonthTransactionRange(
  monthKey: string,
): TransactionDateRange {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  const year = Number(match?.[1])
  const month = Number(match?.[2])

  if (!match || month < 1 || month > 12) {
    throw new Error("조회 월은 YYYY-MM 형식이어야 합니다.")
  }

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`

  return {
    start: `${monthKey}-01T00:00:00+09:00`,
    endExclusive: `${nextMonthKey}-01T00:00:00+09:00`,
  }
}
