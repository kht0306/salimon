import type {
  CardMessageSample,
  Category,
  CategoryBudget,
  Ledger,
  LedgerInvitation,
  LedgerMember,
  LocalSmsCandidate,
  PaymentMethod,
  PaymentInstrument,
  Profile,
  RecurringRule,
  Transaction,
} from "@salimon/types"

export interface FinanceData {
  profile: Profile
  ledgers: Ledger[]
  members: LedgerMember[]
  invitations: LedgerInvitation[]
  categories: Category[]
  categoryBudgets: CategoryBudget[]
  recurringRules: RecurringRule[]
  paymentMethods: PaymentMethod[]
  paymentInstruments: PaymentInstrument[]
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
    categoryBudgets: [],
    recurringRules: [],
    paymentMethods: [],
    paymentInstruments: [],
    transactions: [],
    smsCandidates: [],
    cardMessageSamples: [],
  }
}
