import type {
  AccountDeletionRequest,
  CardMessageSample,
  Category,
  CategoryBudget,
  Ledger,
  LedgerInvitation,
  LegalConsent,
  LedgerMember,
  LedgerMemberEvent,
  LedgerMonthNote,
  LocalSmsCandidate,
  PaymentMethod,
  PaymentInstrument,
  Profile,
  RecurringRule,
  Transaction,
  TransactionSplit,
} from "@salimon/types"

export interface FinanceData {
  profile: Profile
  ledgers: Ledger[]
  members: LedgerMember[]
  memberEvents: LedgerMemberEvent[]
  invitations: LedgerInvitation[]
  categories: Category[]
  categoryBudgets: CategoryBudget[]
  monthNotes: LedgerMonthNote[]
  recurringRules: RecurringRule[]
  paymentMethods: PaymentMethod[]
  paymentInstruments: PaymentInstrument[]
  transactions: Transaction[]
  transactionSplits: TransactionSplit[]
  smsCandidates: LocalSmsCandidate[]
  cardMessageSamples: CardMessageSample[]
  accountDeletionRequest?: AccountDeletionRequest
  legalConsent?: LegalConsent
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
    memberEvents: [],
    invitations: [],
    categories: [],
    categoryBudgets: [],
    monthNotes: [],
    recurringRules: [],
    paymentMethods: [],
    paymentInstruments: [],
    transactions: [],
    transactionSplits: [],
    smsCandidates: [],
    cardMessageSamples: [],
    accountDeletionRequest: undefined,
    legalConsent: undefined,
  }
}
