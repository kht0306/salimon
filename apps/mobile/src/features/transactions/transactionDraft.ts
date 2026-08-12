import {
  fromDateTimeLocalValue,
  getDateTimeLocalValue,
  toDateKey,
} from "@salimon/domain"
import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@salimon/types"

export interface MobileTransactionDraft {
  actorUserId: string
  amount: string
  categoryId: string
  date: string
  merchantName: string
  memo: string
  paymentMethodId: string
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
  incomeKind?: "side_income"
  ledgerId: string
  merchantName?: string
  memo?: string
  paymentMethodId?: string
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
    merchantName: "",
    memo: "",
    paymentMethodId:
      preferredPaymentMethod(input.paymentMethods, "expense")?.id ?? "",
    status: "confirmed",
    tagsInput: "",
    time,
    type: "expense",
  }
}

export function createEditingMobileTransactionDraft(
  transaction: Transaction,
): MobileTransactionDraft {
  const [date = "", time = "12:00"] = getDateTimeLocalValue(
    transaction.transactionAt,
  ).split("T")

  return {
    actorUserId: transaction.actorUserId ?? "",
    amount: String(transaction.amount),
    categoryId: transaction.categoryId ?? "",
    date,
    merchantName: transaction.merchantName ?? "",
    memo: transaction.memo ?? "",
    paymentMethodId: transaction.paymentMethodId ?? "",
    status: transaction.status,
    tagsInput: transaction.tags?.join(", ") ?? "",
    time: time.slice(0, 5),
    type: transaction.type,
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
      incomeKind: draft.type === "income" ? "side_income" : undefined,
      status: draft.status,
      amount,
      transactionAt: fromDateTimeLocalValue(`${draft.date}T${draft.time}`),
      categoryId: category.id,
      merchantName: draft.merchantName.trim() || undefined,
      memo: draft.memo.trim() || undefined,
      actorUserId,
      paymentMethodId,
      sourceType: context.editingTransaction?.sourceType ?? "manual",
      tags,
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
