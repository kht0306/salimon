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

export function createEmptyFinanceData(): FinanceData {
  return {
    profile: {
      id: "",
      nickname: "로그인 필요",
      defaultCurrency: "KRW",
      timezone: "Asia/Seoul",
    },
    ledgers: [],
    members: [],
    invitations: [],
    categories: [],
    paymentMethods: [],
    transactions: [],
    smsCandidates: [],
    cardMessageSamples: [],
  }
}
