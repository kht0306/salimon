import { createDefaultCategories } from "@salimon/domain"
import type {
  CardMessageSample,
  Category,
  Ledger,
  LedgerInvitation,
  LedgerMember,
  LocalSmsCandidate,
  PaymentMethod,
  Profile,
  Transaction,
} from "@salimon/types"

export interface FinanceData {
  profile: Profile
  ledgers: Ledger[]
  members: LedgerMember[]
  invitations: LedgerInvitation[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  transactions: Transaction[]
  smsCandidates: LocalSmsCandidate[]
  cardMessageSamples: CardMessageSample[]
}

const storageKey = "salimon:finance-data:v1"

export class LocalFinanceRepository {
  load(): FinanceData {
    if (typeof window === "undefined") {
      return createInitialFinanceData()
    }

    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      return createInitialFinanceData()
    }

    try {
      return JSON.parse(stored) as FinanceData
    } catch {
      return createInitialFinanceData()
    }
  }

  save(data: FinanceData): void {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(data))
  }

  reset(): FinanceData {
    const data = createInitialFinanceData()
    this.save(data)
    return data
  }
}

export function createInitialFinanceData(): FinanceData {
  const userId = "demo-user"
  const ledgerId = "ledger-personal"
  const sharedLedgerId = "ledger-shared"
  const now = new Date()
  const today = now.toISOString()
  const categories = [
    ...createDefaultCategories(ledgerId, userId),
    ...createDefaultCategories(sharedLedgerId, userId),
  ]
  const food = categories.find((category) => category.ledgerId === ledgerId && category.name === "식비")
  const cafe = categories.find((category) => category.ledgerId === ledgerId && category.name === "카페/간식")
  const salary = categories.find((category) => category.ledgerId === ledgerId && category.name === "급여")

  return {
    profile: {
      id: userId,
      nickname: "데모 사용자",
      defaultCurrency: "KRW",
      timezone: "Asia/Seoul",
    },
    ledgers: [
      {
        id: ledgerId,
        ownerId: userId,
        name: "내 가계부",
        type: "personal",
        currency: "KRW",
        role: "owner",
      },
      {
        id: sharedLedgerId,
        ownerId: userId,
        name: "우리 가계부",
        type: "shared",
        currency: "KRW",
        role: "owner",
      },
    ],
    members: [
      {
        id: "member-demo-owner",
        ledgerId,
        userId,
        nickname: "데모 사용자",
        role: "owner",
        status: "active",
        joinedAt: today,
      },
      {
        id: "member-shared-owner",
        ledgerId: sharedLedgerId,
        userId,
        nickname: "데모 사용자",
        role: "owner",
        status: "active",
        joinedAt: today,
      },
      {
        id: "member-shared-partner",
        ledgerId: sharedLedgerId,
        userId: "partner-user",
        nickname: "초대 멤버",
        role: "member",
        status: "active",
        joinedAt: today,
      },
    ],
    invitations: [],
    categories,
    paymentMethods: [
      {
        id: "pm-card-main",
        ledgerId,
        ownerUserId: userId,
        name: "주 사용 카드",
        type: "card",
        issuer: "카드",
        visibility: "ledger",
        isActive: true,
      },
      {
        id: "pm-cash",
        ledgerId,
        ownerUserId: userId,
        name: "현금",
        type: "cash",
        visibility: "ledger",
        isActive: true,
      },
    ],
    transactions: [
      makeTransaction({
        id: "tx-demo-lunch",
        ledgerId,
        userId,
        amount: 12800,
        categoryId: food?.id,
        merchantName: "연남분식",
        memo: "점심",
        transactionAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 20).toISOString(),
      }),
      makeTransaction({
        id: "tx-demo-coffee",
        ledgerId,
        userId,
        amount: 5800,
        categoryId: cafe?.id,
        merchantName: "스타벅스",
        transactionAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 5).toISOString(),
      }),
      makeTransaction({
        id: "tx-demo-salary",
        ledgerId,
        userId,
        type: "income",
        amount: 3200000,
        categoryId: salary?.id,
        merchantName: "급여",
        transactionAt: new Date(now.getFullYear(), now.getMonth(), 25, 9, 0).toISOString(),
      }),
    ],
    smsCandidates: [],
    cardMessageSamples: [],
  }
}

function makeTransaction(input: {
  id: string
  ledgerId: string
  userId: string
  type?: "expense" | "income"
  amount: number
  categoryId?: string
  merchantName?: string
  memo?: string
  transactionAt: string
}): Transaction {
  const now = new Date().toISOString()
  return {
    id: input.id,
    ledgerId: input.ledgerId,
    createdBy: input.userId,
    type: input.type ?? "expense",
    status: "confirmed",
    amount: input.amount,
    currency: "KRW",
    transactionAt: input.transactionAt,
    categoryId: input.categoryId,
    merchantName: input.merchantName,
    memo: input.memo,
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  }
}
