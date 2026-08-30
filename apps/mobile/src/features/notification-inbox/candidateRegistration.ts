import type { RemoteTransactionInput } from "@salimon/api-client"
import { getDateTimeLocalValue } from "@salimon/domain"
import type {
  Category,
  Ledger,
  LedgerMember,
  LocalSmsCandidate,
  PaymentMethod,
  SmsCandidateRegistrationState,
} from "@salimon/types"
import {
  changeMobileTransactionType,
  createNewMobileTransactionDraft,
  validateMobileTransactionDraft,
  type MobileTransactionDraft,
} from "../transactions/transactionDraft"

export interface CandidateRegistrationDraft {
  amount: string
  candidateId: string
  categoryId: string
  date: string
  ledgerId: string
  merchantName: string
  memo: string
  paymentMethodId: string
  tagsInput: string
  time: string
}

export interface CandidateRegistrationContext {
  authUserId: string
  canWriteData: boolean
  categories: Category[]
  defaultLedgerId: string
  ledgers: Ledger[]
  members: LedgerMember[]
  paymentMethods: PaymentMethod[]
}

export interface ValidatedCandidateRegistration {
  input: RemoteTransactionInput
  registrationState: SmsCandidateRegistrationState
}

export type CandidateRegistrationValidation =
  | { valid: true; value: ValidatedCandidateRegistration }
  | { valid: false; message: string }

export function createCandidateRegistrationDraft(
  candidate: LocalSmsCandidate,
  context: Pick<
    CandidateRegistrationContext,
    "categories" | "defaultLedgerId" | "ledgers" | "paymentMethods"
  >,
): CandidateRegistrationDraft {
  const registrationState = candidate.registrationState
  const candidateLedgerId = registrationState
    ? registrationState.targetLedgerId
    : context.defaultLedgerId || candidate.targetLedgerId || ""
  const ledgerId = context.ledgers.some(
    (ledger) => ledger.id === candidateLedgerId && !ledger.archivedAt,
  )
    ? candidateLedgerId
    : (context.ledgers.find(
        (ledger) => !ledger.archivedAt && ledger.role !== "viewer",
      )?.id ?? "")
  const categories = context.categories.filter(
    (category) => category.ledgerId === ledgerId,
  )
  const paymentMethods = context.paymentMethods.filter(
    (method) => method.ledgerId === ledgerId,
  )
  const transactionAt =
    registrationState?.transactionAt ?? candidate.parsed.transactionAt
  const [date = "", dateTime = "12:00"] =
    getDateTimeLocalValue(transactionAt).split("T")
  const defaults = changeMobileTransactionType(
    createNewMobileTransactionDraft({
      actorUserId: candidate.userId,
      categories,
      paymentMethods,
      selectedDate: date,
      now: new Date(transactionAt),
    }),
    candidate.parsed.type,
    categories,
    paymentMethods,
  )

  return {
    amount: registrationState
      ? String(registrationState.amount)
      : candidate.parsed.originalCurrencyAmount
        ? ""
        : String(candidate.parsed.amount),
    candidateId: candidate.id,
    categoryId: registrationState?.categoryId ?? defaults.categoryId,
    date,
    ledgerId,
    merchantName:
      registrationState?.merchantName ?? candidate.parsed.merchantName ?? "",
    memo: registrationState?.memo ?? candidateRegistrationMemo(candidate),
    paymentMethodId:
      registrationState?.paymentMethodId ?? defaults.paymentMethodId,
    tagsInput: registrationState?.tags?.join(", ") ?? "",
    time: dateTime.slice(0, 5),
  }
}

export function resetCandidateDraftForLedger(
  draft: CandidateRegistrationDraft,
  candidate: LocalSmsCandidate,
  ledgerId: string,
  context: Pick<CandidateRegistrationContext, "categories" | "paymentMethods">,
): CandidateRegistrationDraft {
  const categories = context.categories.filter(
    (category) => category.ledgerId === ledgerId,
  )
  const paymentMethods = context.paymentMethods.filter(
    (method) => method.ledgerId === ledgerId,
  )
  const defaults = changeMobileTransactionType(
    createNewMobileTransactionDraft({
      actorUserId: candidate.userId,
      categories,
      paymentMethods,
      selectedDate: draft.date,
    }),
    candidate.parsed.type,
    categories,
    paymentMethods,
  )

  return {
    ...draft,
    categoryId: defaults.categoryId,
    ledgerId,
    paymentMethodId: defaults.paymentMethodId,
  }
}

export function validateCandidateRegistrationDraft(
  draft: CandidateRegistrationDraft,
  candidate: LocalSmsCandidate,
  context: CandidateRegistrationContext,
  now = new Date(),
): CandidateRegistrationValidation {
  if (draft.candidateId !== candidate.id) {
    return { valid: false, message: "검토 중인 알림 후보가 변경되었습니다." }
  }
  if (now.getTime() >= new Date(candidate.reviewDeadlineAt).getTime()) {
    return {
      valid: false,
      message: "7일 보관 기간이 지나 자동 삭제된 후보입니다.",
    }
  }
  if (!context.canWriteData) {
    return {
      valid: false,
      message: "최신 가계부 정보를 불러온 뒤 다시 등록해 주세요.",
    }
  }
  if (
    candidate.registrationState &&
    !matchesPendingRegistration(draft, candidate.registrationState)
  ) {
    return {
      valid: false,
      message:
        "등록 결과가 불명확한 후보는 중복 방지를 위해 내용을 변경할 수 없습니다. 저장했던 내용으로 다시 시도해 주세요.",
    }
  }

  const ledger = context.ledgers.find(
    (item) => item.id === draft.ledgerId && !item.archivedAt,
  )
  if (!ledger || ledger.role === "viewer") {
    return {
      valid: false,
      message: "거래를 등록할 권한이 있는 가계부를 선택해 주세요.",
    }
  }

  const transactionDraft: MobileTransactionDraft = {
    actorUserId: context.authUserId,
    amount: draft.amount,
    categoryId: draft.categoryId,
    date: draft.date,
    incomeKind: "side_income",
    installmentAmountType: "monthly",
    installmentMonths: "2",
    merchantName: draft.merchantName,
    memo: draft.memo,
    paymentMethodId: draft.paymentMethodId,
    recurringType: "",
    applyChangesToFuture: true,
    splits: [],
    status: "confirmed",
    sourceType: "android_sms_notification",
    tagsInput: draft.tagsInput,
    time: draft.time,
    type: candidate.parsed.type,
  }
  const validation = validateMobileTransactionDraft(transactionDraft, {
    categories: context.categories.filter(
      (category) => category.ledgerId === ledger.id,
    ),
    ledgerId: ledger.id,
    members: context.members.filter((member) => member.ledgerId === ledger.id),
    paymentMethods: context.paymentMethods.filter(
      (method) => method.ledgerId === ledger.id,
    ),
  })
  if (!validation.valid) return validation

  const input: RemoteTransactionInput = {
    ...validation.input,
    parseConfidence: candidate.parsed.confidence,
    sourceApp: candidate.sourceApp,
    sourceHash: candidate.sourceHash,
    sourceSender: candidate.sourceSender,
    sourceType: "android_sms_notification",
  }

  return {
    valid: true,
    value: {
      input,
      registrationState: {
        amount: input.amount,
        categoryId: input.categoryId ?? "",
        merchantName: input.merchantName,
        memo: input.memo,
        paymentMethodId: input.paymentMethodId,
        targetLedgerId: input.ledgerId,
        tags: input.tags,
        transactionAt: input.transactionAt,
        updatedAt: now.toISOString(),
      },
    },
  }
}

function candidateRegistrationMemo(candidate: LocalSmsCandidate): string {
  const details: string[] = []
  if (candidate.parsed.cardNotificationEvent === "approval_cancellation") {
    details.push("카드 승인취소")
  }
  const originalAmount = candidate.parsed.originalCurrencyAmount
  if (originalAmount) {
    details.push(
      `원승인금액 ${originalAmount.currencyCode} ${originalAmount.amount}`,
    )
  }
  return details.join(" · ")
}

export function isRetryableCandidateRegistrationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      /aborted|fetch failed|failed to fetch|network(?: request)? (?:failed|unavailable)|unknownhostexception|unable to resolve host|응답이 지연/i.test(
        error.message,
      ))
  )
}

function matchesPendingRegistration(
  draft: CandidateRegistrationDraft,
  state: SmsCandidateRegistrationState,
): boolean {
  const [date = "", dateTime = ""] = getDateTimeLocalValue(
    state.transactionAt,
  ).split("T")
  return (
    Number(draft.amount) === state.amount &&
    draft.categoryId === state.categoryId &&
    draft.date === date &&
    draft.ledgerId === state.targetLedgerId &&
    draft.merchantName.trim() === (state.merchantName ?? "") &&
    draft.memo.trim() === (state.memo ?? "") &&
    draft.paymentMethodId === (state.paymentMethodId ?? "") &&
    draft.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(",") === (state.tags ?? []).join(",") &&
    draft.time === dateTime.slice(0, 5)
  )
}
