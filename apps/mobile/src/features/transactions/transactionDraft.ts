import {
  fromDateTimeLocalValue,
  getDateTimeLocalValue,
  isSplitCategory,
  toDateKey,
} from "@salimon/domain"
import type {
  Category,
  IncomeKind,
  LedgerMember,
  PaymentMethod,
  RecurringRule,
  Transaction,
  TransactionSplit,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"

export interface MobileTransactionSplitDraft {
  amount: string
  categoryId: string
}

export interface MobileTransactionDraft {
  actorUserId: string
  amount: string
  categoryId: string
  date: string
  incomeKind: IncomeKind
  installmentAmountType: "monthly" | "principal"
  installmentMonths: string
  merchantName: string
  memo: string
  paymentMethodId: string
  recurringType: "" | "fixed" | "installment"
  applyChangesToFuture: boolean
  splits: MobileTransactionSplitDraft[]
  status: TransactionStatus
  tagsInput: string
  time: string
  type: TransactionType
}

export interface MobileGeneralTransactionInput {
  actorUserId?: string
  amount: number
  categoryId: string
  id?: string
  incomeKind?: IncomeKind
  installmentAmountType?: "monthly" | "principal"
  installmentMonths?: number
  ledgerId: string
  merchantName?: string
  memo?: string
  paymentMethodId?: string
  recurringRuleId?: string
  recurringType?: "fixed" | "installment"
  applyChangesToFuture?: boolean
  splits?: { amount: number; categoryId: string }[]
  sourceType: Transaction["sourceType"]
  status: TransactionStatus
  tags: string[]
  transactionAt: string
  type: TransactionType
}

export interface TransactionDraftContext {
  categories: Category[]
  editingTransaction?: Transaction
  ledgerId: string
  members: LedgerMember[]
  paymentMethods: PaymentMethod[]
  transactionSplits?: TransactionSplit[]
}

export type TransactionDraftValidation =
  | { valid: true; input: MobileGeneralTransactionInput }
  | { valid: false; message: string }

export function createNewMobileTransactionDraft(input: {
  actorUserId?: string
  categories: Category[]
  paymentMethods: PaymentMethod[]
  selectedDate: string
  now?: Date
}): MobileTransactionDraft {
  const now = input.now ?? new Date()
  const today = toDateKey(now)
  const selectedDate = isValidDate(input.selectedDate)
    ? input.selectedDate
    : today
  const time =
    selectedDate === today
      ? `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes(),
        ).padStart(2, "0")}`
      : "12:00"

  return {
    actorUserId: input.actorUserId ?? "",
    amount: "",
    categoryId: preferredCategory(input.categories, "expense")?.id ?? "",
    date: selectedDate,
    incomeKind: "side_income",
    installmentAmountType: "monthly",
    installmentMonths: "2",
    merchantName: "",
    memo: "",
    paymentMethodId:
      preferredPaymentMethod(input.paymentMethods, "expense")?.id ?? "",
    recurringType: "",
    applyChangesToFuture: true,
    splits: [],
    status: "confirmed",
    tagsInput: "",
    time,
    type: "expense",
  }
}

export function createEditingMobileTransactionDraft(
  transaction: Transaction,
  transactionSplits: TransactionSplit[] = [],
  recurringRule?: RecurringRule,
): MobileTransactionDraft {
  const [date = "", time = "12:00"] = getDateTimeLocalValue(
    transaction.transactionAt,
  ).split("T")

  return {
    actorUserId: transaction.actorUserId ?? "",
    amount: String(transaction.amount),
    categoryId: transaction.categoryId ?? "",
    date,
    incomeKind: transaction.incomeKind ?? "side_income",
    installmentAmountType: recurringRule?.installmentAmountType ?? "monthly",
    installmentMonths: String(
      recurringRule?.installmentMonths ?? transaction.installmentTotal ?? 2,
    ),
    merchantName: transaction.merchantName ?? "",
    memo: transaction.memo ?? "",
    paymentMethodId: transaction.paymentMethodId ?? "",
    recurringType: transaction.recurringType ?? "",
    applyChangesToFuture: true,
    splits: transactionSplits.map((split) => ({
      amount: String(split.amount),
      categoryId: split.categoryId,
    })),
    status: transaction.status,
    tagsInput: transaction.tags?.join(", ") ?? "",
    time: time.slice(0, 5),
    type: transaction.type,
  }
}

export function createCopiedMobileTransactionDraft(
  transaction: Transaction,
  transactionSplits: TransactionSplit[] = [],
): MobileTransactionDraft {
  return {
    ...createEditingMobileTransactionDraft(transaction, transactionSplits),
    recurringType: "",
    installmentAmountType: "monthly",
    installmentMonths: "2",
    applyChangesToFuture: true,
  }
}

export function changeMobileTransactionType(
  draft: MobileTransactionDraft,
  type: TransactionType,
  categories: Category[],
  paymentMethods: PaymentMethod[],
): MobileTransactionDraft {
  const currentCategory = categories.find(
    (category) =>
      category.id === draft.categoryId &&
      !category.isArchived &&
      category.usageTypes.includes(type),
  )
  const currentPaymentMethod = paymentMethods.find(
    (method) =>
      method.id === draft.paymentMethodId &&
      isSelectablePaymentMethod(method, type),
  )

  return {
    ...draft,
    type,
    incomeKind: type === "income" ? draft.incomeKind : "side_income",
    recurringType:
      type === "income" && draft.incomeKind === "salary"
        ? "fixed"
        : draft.recurringType === "installment" && type !== "expense"
          ? ""
          : draft.recurringType,
    splits: [],
    categoryId:
      currentCategory?.id ?? preferredCategory(categories, type)?.id ?? "",
    paymentMethodId:
      type === "income"
        ? ""
        : (currentPaymentMethod?.id ??
          preferredPaymentMethod(paymentMethods, type)?.id ??
          ""),
  }
}

export function validateMobileTransactionDraft(
  draft: MobileTransactionDraft,
  context: TransactionDraftContext,
): TransactionDraftValidation {
  const amount = Number(draft.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { valid: false, message: "금액을 1원 이상 숫자로 입력해 주세요." }
  }
  if (!isValidDate(draft.date) || !isValidTime(draft.time)) {
    return {
      valid: false,
      message: "거래 날짜와 시간을 올바른 형식으로 입력해 주세요.",
    }
  }
  if (!context.ledgerId) {
    return { valid: false, message: "거래를 저장할 가계부가 없습니다." }
  }

  const category = context.categories.find(
    (item) =>
      item.id === draft.categoryId && item.ledgerId === context.ledgerId,
  )
  const originalCategoryId = context.editingTransaction?.categoryId
  if (!category) {
    return { valid: false, message: "카테고리를 선택해 주세요." }
  }
  if (
    (category.isArchived && category.id !== originalCategoryId) ||
    !category.usageTypes.includes(draft.type)
  ) {
    return {
      valid: false,
      message: "거래 유형에 사용할 수 있는 카테고리를 선택해 주세요.",
    }
  }

  const actorUserId = draft.actorUserId || undefined
  if (
    actorUserId &&
    !context.members.some(
      (member) =>
        member.userId === actorUserId &&
        member.ledgerId === context.ledgerId &&
        member.status === "active",
    )
  ) {
    return { valid: false, message: "현재 가계부의 거래자를 선택해 주세요." }
  }

  const paymentMethodId =
    draft.type === "income" ? undefined : draft.paymentMethodId || undefined
  const paymentMethod = context.paymentMethods.find(
    (method) =>
      method.id === paymentMethodId && method.ledgerId === context.ledgerId,
  )
  const originalPaymentMethodId = context.editingTransaction?.paymentMethodId
  if (draft.type === "saving" && !paymentMethod) {
    return { valid: false, message: "저축에 사용할 계좌를 선택해 주세요." }
  }
  if (
    paymentMethod &&
    (!paymentMethod.isActive || paymentMethod.isDeleted) &&
    paymentMethod.id !== originalPaymentMethodId
  ) {
    return {
      valid: false,
      message: "현재 사용할 수 있는 결제수단을 선택해 주세요.",
    }
  }
  if (draft.type === "saving" && paymentMethod?.type !== "bank") {
    return { valid: false, message: "저축 거래에는 계좌를 선택해 주세요." }
  }

  if (
    draft.type === "income" &&
    draft.incomeKind === "salary" &&
    draft.recurringType !== "fixed"
  ) {
    return { valid: false, message: "급여 수입은 고정 거래로 등록해 주세요." }
  }

  const installmentMonths = Number(draft.installmentMonths)
  if (draft.recurringType === "installment") {
    if (draft.type !== "expense") {
      return {
        valid: false,
        message: "할부는 지출 거래에만 사용할 수 있습니다.",
      }
    }
    if (
      !Number.isSafeInteger(installmentMonths) ||
      installmentMonths < 2 ||
      installmentMonths > 120
    ) {
      return { valid: false, message: "할부 개월은 2~120개월로 입력해 주세요." }
    }
    if (!paymentMethod || paymentMethod.type !== "card") {
      return { valid: false, message: "할부에 사용할 카드를 선택해 주세요." }
    }
    if (!context.editingTransaction && !paymentMethod.paymentDay) {
      return {
        valid: false,
        message: "결제일이 설정된 카드만 새 할부에 사용할 수 있습니다.",
      }
    }
    if (
      draft.installmentAmountType === "principal" &&
      amount < installmentMonths
    ) {
      return {
        valid: false,
        message: "총 원금은 할부 개월 수보다 작을 수 없습니다.",
      }
    }
  }

  const splitCategorySelected = isSplitCategory(category)
  const splits = splitCategorySelected ? draft.splits : []
  if (splitCategorySelected && draft.recurringType) {
    return {
      valid: false,
      message: "분할 거래와 고정·할부 설정은 함께 사용할 수 없습니다.",
    }
  }
  if (splitCategorySelected) {
    const originalSplitCategoryIds = new Set(
      context.transactionSplits?.map((split) => split.categoryId) ?? [],
    )
    const splitTotal = splits.reduce(
      (sum, split) => sum + Number(split.amount),
      0,
    )
    const categoryIds = new Set(splits.map((split) => split.categoryId))
    const validSplits =
      splits.length >= 2 &&
      splits.length <= 10 &&
      categoryIds.size === splits.length &&
      splits.every((split) => {
        const splitCategory = context.categories.find(
          (item) => item.id === split.categoryId,
        )
        const splitAmount = Number(split.amount)
        return Boolean(
          splitCategory &&
          (!splitCategory.isArchived ||
            originalSplitCategoryIds.has(splitCategory.id)) &&
          !isSplitCategory(splitCategory) &&
          splitCategory.usageTypes.includes(draft.type) &&
          Number.isSafeInteger(splitAmount) &&
          splitAmount > 0,
        )
      }) &&
      splitTotal === amount
    if (!validSplits) {
      return {
        valid: false,
        message:
          "분할 항목은 서로 다른 카테고리 2~10개로 입력하고 합계를 거래 금액과 맞춰 주세요.",
      }
    }
  }

  const tags = [
    ...new Set(
      draft.tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
  if (tags.length > 10 || tags.some((tag) => tag.length > 20)) {
    return {
      valid: false,
      message: "태그는 20자 이내로 최대 10개까지 입력해 주세요.",
    }
  }

  return {
    valid: true,
    input: {
      id: context.editingTransaction?.id,
      ledgerId: context.ledgerId,
      type: draft.type,
      incomeKind: draft.type === "income" ? draft.incomeKind : undefined,
      status: draft.status,
      amount,
      transactionAt: context.editingTransaction?.recurringType
        ? context.editingTransaction.transactionAt
        : fromDateTimeLocalValue(`${draft.date}T${draft.time}`),
      categoryId: category.id,
      merchantName: draft.merchantName.trim() || undefined,
      memo: draft.memo.trim() || undefined,
      actorUserId,
      paymentMethodId,
      recurringRuleId: context.editingTransaction?.recurringRuleId,
      ...(draft.recurringType ? { recurringType: draft.recurringType } : {}),
      ...(draft.recurringType === "installment"
        ? {
            installmentMonths,
            installmentAmountType: draft.installmentAmountType,
          }
        : {}),
      applyChangesToFuture: context.editingTransaction
        ? draft.applyChangesToFuture
        : undefined,
      sourceType: context.editingTransaction?.sourceType ?? "manual",
      tags,
      splits: splitCategorySelected
        ? splits.map((split) => ({
            amount: Number(split.amount),
            categoryId: split.categoryId,
          }))
        : [],
    },
  }
}

export function isGeneralMobileTransaction(
  transaction: Transaction,
  splitCount: number,
): boolean {
  return (
    !transaction.recurringType &&
    !transaction.recurringRuleId &&
    splitCount === 0
  )
}

export function normalizeAmountInput(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
}

function preferredCategory(
  categories: Category[],
  type: TransactionType,
): Category | undefined {
  return categories
    .filter(
      (category) => !category.isArchived && category.usageTypes.includes(type),
    )
    .sort(
      (first, second) =>
        Number(second.isDefault) - Number(first.isDefault) ||
        first.sortOrder - second.sortOrder,
    )[0]
}

function preferredPaymentMethod(
  paymentMethods: PaymentMethod[],
  type: TransactionType,
): PaymentMethod | undefined {
  return paymentMethods
    .filter((method) => isSelectablePaymentMethod(method, type))
    .sort(
      (first, second) =>
        Number(second.isPrimary) - Number(first.isPrimary) ||
        first.name.localeCompare(second.name, "ko-KR"),
    )[0]
}

function isSelectablePaymentMethod(
  method: PaymentMethod,
  type: TransactionType,
): boolean {
  if (!method.isActive || method.isDeleted || type === "income") return false
  return type === "saving" ? method.type === "bank" : true
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}
