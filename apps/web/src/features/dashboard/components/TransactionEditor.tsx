"use client"

import styled from "@emotion/styled"
import {
  formatKoreanDate,
  formatMoneyInput,
  formatKrw,
  getCategoryLabel,
  isSplitCategory,
  splitInstallmentPrincipal,
} from "@salimon/domain"
import type { CategoryUsageType, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Copy, ListPlus, Save, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useRef, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  IconButton,
  Input,
  RequiredMark,
  Select,
  Textarea,
} from "../styles"
import {
  getIncomeRecurringType,
  getInstallmentPaymentMethodId,
  getTransactionAtForSave,
  isInstallmentEditLocked,
  type TransactionEditorDraft,
} from "./transactionEditorDraft"
import { buildInstallmentSchedulePreview } from "./installmentSchedule"
import {
  getPaymentMethodTypeLabel,
  sortPaymentMethodsForSelection,
} from "./transactionPresentation"

export interface TransactionSplitDraft {
  categoryId: string
  amount: string
}

export interface TransactionEditorSession {
  id: number
  editing: Transaction | null
  copySource: Transaction | null
  initialDraft: TransactionEditorDraft
  receiptWarnings: string[]
  initialTagsInput: string
  initialSplits: TransactionSplitDraft[]
}

interface TransactionEditorProps {
  session: TransactionEditorSession
  onClose: () => void
}

export const TransactionEditor = observer(function TransactionEditor({
  session,
  onClose,
}: TransactionEditorProps) {
  const store = useAppStore()
  const {
    editing,
    copySource,
    initialDraft,
    receiptWarnings,
    initialTagsInput,
    initialSplits,
  } = session
  const [isSaving, setSaving] = useState(false)
  const [tagsInput, setTagsInput] = useState(initialTagsInput)
  const [splits, setSplits] = useState(initialSplits)
  const initialTagsRef = useRef(initialTagsInput)
  const initialSplitsRef = useRef(initialSplits)
  const editorRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const [draft, setDraft] = useState(initialDraft)
  const initialDraftRef = useRef(initialDraft)
  const isEditingInstallment = isInstallmentEditLocked(editing)
  const isEditingFixed = editing?.recurringType === "fixed"
  const isEditingRecurring = isEditingFixed || isEditingInstallment
  const isSalaryIncome =
    draft.type === "income" && draft.incomeKind === "salary"
  const merchantLabel = isSalaryIncome
    ? "회사명"
    : draft.type === "income" && draft.incomeKind === "side_income"
      ? "지급처/지급인"
      : "가맹점/내용"

  useEffect(() => {
    if (!store.transactionEditorOpen) return

    editorRef.current?.scrollIntoView({ block: "start" })
  }, [copySource, editing, store.transactionEditorOpen])

  useEffect(() => {
    const dirty =
      store.transactionEditorOpen &&
      (JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current) ||
        tagsInput !== initialTagsRef.current ||
        JSON.stringify(splits) !== JSON.stringify(initialSplitsRef.current))
    store.setTransactionEditorDirty(dirty)
  }, [draft, splits, store, store.transactionEditorOpen, tagsInput])

  const amount = Number(draft.amount)
  const splitCategorySelected = isSplitCategory(
    store.currentCategories.find(
      (category) => category.id === draft.categoryId,
    ),
  )
  const splitTotal = splits.reduce(
    (sum, split) => sum + Number(split.amount || 0),
    0,
  )
  const splitsValid =
    splits.length === 0 ||
    (splitCategorySelected &&
      draft.recurringType === "none" &&
      splits.length <= 10 &&
      new Set(splits.map((split) => split.categoryId)).size === splits.length &&
      splits.every(
        (split) =>
          Boolean(split.categoryId) &&
          Number.isSafeInteger(Number(split.amount)) &&
          Number(split.amount) > 0,
      ) &&
      splitTotal === amount)
  const installmentMonths = Number(draft.installmentMonths)
  const installmentAmounts =
    draft.recurringType === "installment" &&
    draft.installmentAmountType === "principal" &&
    Number.isSafeInteger(amount) &&
    Number.isSafeInteger(installmentMonths) &&
    installmentMonths > 0
      ? splitInstallmentPrincipal(amount, installmentMonths)
      : []
  const installmentMonthlyAmount = installmentAmounts[0] ?? amount
  const [transactionDate = "", transactionTimeValue = "12:00"] =
    draft.transactionAt.split("T")
  const transactionTime = transactionTimeValue.slice(0, 5)
  const installmentCard = store.currentCards.find(
    (card) => card.id === draft.paymentMethodId,
  )
  const installmentSchedule = buildInstallmentSchedulePreview({
    purchaseDate: transactionDate,
    paymentDay: installmentCard?.paymentDay,
    installmentMonths,
  })
  const installmentScheduleSummary =
    installmentSchedule.length <= 4
      ? installmentSchedule
      : installmentSchedule.filter(
          (_, index) => index < 3 || index === installmentSchedule.length - 1,
        )
  const selectableCategories = store.currentCategories.filter((category) =>
    category.usageTypes.includes(draft.type as CategoryUsageType),
  )
  const splitSelectableCategories = selectableCategories.filter(
    (category) => !isSplitCategory(category),
  )
  const categoryLabel = (categoryId: string): string =>
    getCategoryLabel(store.currentCategories, categoryId, "삭제된 카테고리")
  const savingAccountIsValid =
    draft.type !== "saving" ||
    store.currentAccounts.some(
      (account) => account.id === draft.paymentMethodId,
    )
  const canSave =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    isValidDateInput(transactionDate) &&
    /^\d{2}:\d{2}$/.test(transactionTime) &&
    Boolean(store.selectedLedgerId) &&
    savingAccountIsValid &&
    (draft.type !== "income" ||
      (Boolean(draft.incomeKind) &&
        (draft.incomeKind !== "salary" || draft.recurringType === "fixed"))) &&
    splitsValid &&
    (draft.recurringType !== "installment" ||
      (Number.isSafeInteger(installmentMonths) &&
        installmentMonths >= 2 &&
        installmentMonths <= 120 &&
        Boolean(draft.paymentMethodId) &&
        store.currentCards.length > 0 &&
        (isEditingInstallment || Boolean(installmentCard?.paymentDay)) &&
        (isEditingInstallment ||
          draft.installmentAmountType !== "principal" ||
          amount >= installmentMonths)))
  const possibleDuplicates = store.data.transactions.filter((transaction) => {
    if (
      transaction.id === editing?.id ||
      transaction.ledgerId !== store.selectedLedgerId ||
      transaction.deletedAt ||
      transaction.type !== draft.type ||
      transaction.amount !== amount
    ) {
      return false
    }
    const sameMerchant =
      !draft.merchantName.trim() ||
      transaction.merchantName?.trim().toLowerCase() ===
        draft.merchantName.trim().toLowerCase()
    return (
      sameMerchant &&
      Math.abs(
        new Date(draft.transactionAt).getTime() -
          new Date(transaction.transactionAt).getTime(),
      ) <=
        15 * 60_000
    )
  })
  function closeForm() {
    onClose()
  }

  async function save() {
    if (savingRef.current) return

    const amount = Number(draft.amount)
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return
    }
    if (
      editing &&
      !editing.recurringType &&
      draft.recurringType === "fixed" &&
      !window.confirm("이 거래부터 매월 반복되는 고정 거래로 전환할까요?")
    ) {
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      const saved = await store.saveTransaction({
        id: editing?.id,
        ledgerId: store.selectedLedgerId,
        type: draft.type as Transaction["type"],
        incomeKind: draft.type === "income" ? draft.incomeKind : undefined,
        status: draft.status,
        amount,
        transactionAt: getTransactionAtForSave(draft.transactionAt, editing),
        categoryId: draft.categoryId || undefined,
        merchantName: draft.merchantName || undefined,
        memo: draft.memo || undefined,
        actorUserId: draft.actorUserId || undefined,
        recurringType:
          draft.recurringType === "none"
            ? undefined
            : (draft.recurringType as "fixed" | "installment"),
        recurringRuleId: draft.recurringRuleId,
        paymentMethodId:
          draft.type === "expense" || draft.type === "saving"
            ? draft.paymentMethodId || undefined
            : undefined,
        installmentMonths:
          draft.recurringType === "installment"
            ? Number(draft.installmentMonths)
            : undefined,
        installmentAmountType:
          draft.recurringType === "installment"
            ? draft.installmentAmountType
            : undefined,
        applyChangesToFuture: draft.applyChangesToFuture,
        sourceType: draft.sourceType,
        parseConfidence: draft.parseConfidence,
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        splits: (splitCategorySelected ? splits : []).map((split) => ({
          categoryId: split.categoryId,
          amount: Number(split.amount),
        })),
      })
      if (saved) {
        closeForm()
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Editor ref={editorRef}>
      <EditorHeader>
        <strong>
          {editing
            ? "거래 수정"
            : copySource
              ? "거래 복사 · 신규 등록"
              : "거래 추가"}
        </strong>
        <IconButton title="닫기" onClick={closeForm}>
          <X size={16} />
        </IconButton>
      </EditorHeader>

      {copySource ? (
        <CopyNotice role="status">
          <Copy size={16} />
          <span>
            원본 거래 내용을 복사한 신규 거래입니다. 저장하면 별도 거래로
            등록됩니다.
          </span>
        </CopyNotice>
      ) : null}

      {draft.sourceType === "receipt_ai" ? (
        <ReceiptNotice role="status">
          <strong>AI가 만든 영수증 초안입니다.</strong>
          <span>
            정확도 {Math.round((draft.parseConfidence ?? 0) * 100)}% · 금액,
            거래일시, 가맹점을 반드시 확인해 주세요.
          </span>
          {receiptWarnings.map((warning) => (
            <small key={warning}>· {warning}</small>
          ))}
        </ReceiptNotice>
      ) : null}

      <TwoColumns>
        <Field>
          <span>
            유형<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={draft.type}
            disabled={isEditingRecurring}
            onChange={(event) => {
              const type = event.target.value as Transaction["type"]
              setSplits([])
              setDraft({
                ...draft,
                type,
                incomeKind: type === "income" ? "side_income" : undefined,
                categoryId:
                  store.currentCategories.find((category) =>
                    category.usageTypes.includes(type as CategoryUsageType),
                  )?.id ?? "",
                recurringType: "none",
                paymentMethodId:
                  type === "expense"
                    ? draft.paymentMethodId ||
                      store.currentUserPrimaryCard?.id ||
                      ""
                    : type === "saving"
                      ? store.currentAccounts.some(
                          (account) => account.id === draft.paymentMethodId,
                        )
                        ? draft.paymentMethodId
                        : store.currentAccounts[0]?.id || ""
                      : "",
              })
            }}
          >
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="saving">저축</option>
          </Select>
        </Field>
        <Field>
          <span>
            상태<RequiredMark>*</RequiredMark>
          </span>
          <Select
            required
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value as Transaction["status"],
              })
            }
          >
            <option value="confirmed">확정</option>
            <option value="excluded">제외</option>
          </Select>
        </Field>
      </TwoColumns>

      <TwoColumns>
        {draft.type === "income" ? (
          <Field>
            수입 유형
            <Select
              value={draft.incomeKind ?? "side_income"}
              disabled={isEditingFixed}
              onChange={(event) => {
                const incomeKind = event.target.value as
                  | "salary"
                  | "side_income"
                const recurringType = getIncomeRecurringType(incomeKind)
                if (recurringType === "fixed") {
                  setSplits([])
                  setTagsInput("")
                }
                setDraft({ ...draft, incomeKind, recurringType })
              }}
            >
              <option value="salary">월급</option>
              <option value="side_income">부수입</option>
            </Select>
          </Field>
        ) : (
          <Field>
            반복 유형
            <Select
              value={draft.recurringType}
              disabled={isEditingRecurring}
              onChange={(event) => {
                const recurringType = event.target
                  .value as TransactionEditorDraft["recurringType"]
                if (recurringType !== "none") {
                  setSplits([])
                  setTagsInput("")
                }
                setDraft({
                  ...draft,
                  recurringType,
                  paymentMethodId:
                    recurringType === "installment"
                      ? getInstallmentPaymentMethodId({
                          currentPaymentMethodId: draft.paymentMethodId,
                          activeCardIds: new Set(
                            store.currentCards.map((card) => card.id),
                          ),
                          primaryCardId: store.currentUserPrimaryCard?.id,
                        })
                      : draft.paymentMethodId,
                })
              }}
            >
              <option value="none">일반 거래</option>
              <option value="fixed">
                {draft.type === "saving" ? "정기저축" : "고정비"}
              </option>
              <option value="installment" disabled={draft.type !== "expense"}>
                카드 할부
              </option>
            </Select>
          </Field>
        )}
        {draft.type === "income" && draft.incomeKind === "side_income" ? (
          <IncomeRecurrenceCard
            as="label"
            $checked={draft.recurringType === "fixed"}
            $interactive
          >
            <input
              type="checkbox"
              checked={draft.recurringType === "fixed"}
              disabled={isEditingFixed}
              onChange={(event) => {
                const recurringType = getIncomeRecurringType(
                  "side_income",
                  event.target.checked,
                )
                if (recurringType === "fixed") {
                  setSplits([])
                  setTagsInput("")
                }
                setDraft({ ...draft, recurringType })
              }}
            />
            <span>
              <strong>고정 수입</strong>
              <small>매월 같은 일자에 거래 생성</small>
            </span>
          </IncomeRecurrenceCard>
        ) : draft.type === "income" ? (
          <IncomeRecurrenceCard role="status">
            <span>월급은 매월 고정수입으로 등록됩니다.</span>
          </IncomeRecurrenceCard>
        ) : null}
        {draft.recurringType === "installment" ? (
          <Field>
            <span>
              할부 개월<RequiredMark>*</RequiredMark>
            </span>
            {editing?.recurringType === "installment"
              ? ` (${editing.installmentNumber ?? 1}/${draft.installmentMonths})`
              : ""}
            <Input
              required
              type="number"
              min="2"
              max="120"
              disabled={isEditingInstallment}
              value={draft.installmentMonths}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  installmentMonths: event.target.value,
                })
              }
            />
          </Field>
        ) : draft.type === "income" ? null : (
          <div />
        )}
      </TwoColumns>

      {isEditingInstallment ? (
        <EditPolicyNotice role="status">
          할부 거래는 거래 유형, 반복 유형, 할부 개월, 결제 수단, 거래일시를
          변경할 수 없습니다. 금액은 선택한 회차 기준으로 수정됩니다.
        </EditPolicyNotice>
      ) : isEditingFixed ? (
        <EditPolicyNotice role="status">
          고정 거래의 유형, 수입 유형, 반복 여부와 거래일시는 변경할 수
          없습니다. 반복 종료는 거래 목록의 종료 작업을 이용해 주세요.
        </EditPolicyNotice>
      ) : null}

      {draft.type === "expense" || draft.type === "saving" ? (
        <Field>
          <span>
            {draft.type === "saving" ? "거래 수단" : "결제 수단"}
            {draft.type === "saving" ||
            draft.recurringType === "installment" ? (
              <RequiredMark>*</RequiredMark>
            ) : null}
          </span>
          <Select
            required={
              draft.type === "saving" || draft.recurringType === "installment"
            }
            value={draft.paymentMethodId}
            disabled={isEditingInstallment}
            onChange={(event) =>
              setDraft({ ...draft, paymentMethodId: event.target.value })
            }
          >
            <option value="">
              {draft.type === "saving"
                ? "계좌를 선택해 주세요"
                : draft.recurringType === "installment"
                  ? "카드를 선택해 주세요"
                  : "현금"}
            </option>
            {store.currentMembers.map((member) => {
              const memberMethods = sortPaymentMethodsForSelection(
                (draft.type === "saving"
                  ? store.currentAccounts
                  : draft.recurringType === "installment"
                    ? store.currentCards
                    : store.currentPaymentMethods
                ).filter((method) => method.ownerUserId === member.userId),
              )
              return memberMethods.length > 0 ? (
                <optgroup key={member.userId} label={member.nickname}>
                  {memberMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {`${method.isPrimary ? "[주 카드] " : ""}[${getPaymentMethodTypeLabel(method)}] ${method.issuer} · ${method.name}${method.last4 ? ` (${method.last4})` : ""}`}
                    </option>
                  ))}
                </optgroup>
              ) : null
            })}
          </Select>
          {draft.recurringType === "installment" &&
          store.currentCards.length === 0 ? (
            <CardRequired role="alert">
              내 카드 메뉴에서 카드를 먼저 등록하고 가계부에 연결해 주세요.
            </CardRequired>
          ) : draft.recurringType === "installment" &&
            draft.paymentMethodId &&
            !installmentCard?.paymentDay ? (
            <CardRequired role="alert">
              선택한 카드에 결제일을 먼저 등록해 주세요.
            </CardRequired>
          ) : null}
          {draft.type === "saving" && store.currentAccounts.length === 0 ? (
            <CardRequired role="alert">
              내 계좌 메뉴에서 계좌를 먼저 등록하고 가계부에 연결해 주세요.
            </CardRequired>
          ) : null}
        </Field>
      ) : null}

      <Field>
        <span>
          금액
          <RequiredMark>*</RequiredMark>
        </span>
        <AmountControl
          $withType={
            draft.recurringType === "installment" && !isEditingInstallment
          }
        >
          {draft.recurringType === "installment" && !isEditingInstallment ? (
            <Select
              aria-label="할부 금액 입력 방식"
              value={draft.installmentAmountType}
              disabled={isEditingInstallment}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  installmentAmountType: event.target.value as
                    | "monthly"
                    | "principal",
                })
              }
            >
              <option value="monthly">월별 납입액</option>
              <option value="principal">할부 원금</option>
            </Select>
          ) : null}
          <Input
            required
            type="text"
            inputMode="numeric"
            pattern="[0-9,]*"
            autoComplete="off"
            value={formatMoneyInput(draft.amount)}
            onChange={(event) =>
              setDraft({
                ...draft,
                amount: event.target.value.replace(/\D/g, ""),
              })
            }
          />
        </AmountControl>
        {isEditingInstallment ? (
          <InstallmentPreview>
            선택한 {editing?.installmentNumber ?? 1}회차 거래 금액
          </InstallmentPreview>
        ) : draft.recurringType === "installment" &&
          draft.installmentAmountType === "principal" &&
          installmentMonthlyAmount > 0 ? (
          <InstallmentPreview>
            월 {formatKrw(installmentMonthlyAmount)} · 마지막 회차에 잔액 반영
          </InstallmentPreview>
        ) : null}
      </Field>

      {isEditingFixed || isEditingInstallment ? (
        <FutureAmountScope $checked={draft.applyChangesToFuture}>
          <input
            type="checkbox"
            checked={draft.applyChangesToFuture}
            onChange={(event) =>
              setDraft({
                ...draft,
                applyChangesToFuture: event.target.checked,
              })
            }
          />
          <span>
            <strong>
              {isEditingFixed
                ? "변경 내용을 이 달 이후 거래에도 적용"
                : "변경 금액을 이 달 이후 거래에도 적용"}
            </strong>
            <small>
              {draft.applyChangesToFuture
                ? "이전 달 거래는 유지하고 선택한 달부터 반영합니다."
                : isEditingFixed
                  ? "선택한 달의 거래만 수정합니다."
                  : "선택한 달의 거래 금액만 수정합니다."}
            </small>
          </span>
        </FutureAmountScope>
      ) : null}

      <Field>
        <span>
          {draft.recurringType === "installment" ? "카드 구매일시" : "거래일시"}
          <RequiredMark>*</RequiredMark>
        </span>
        <DateTimeInputs>
          <Input
            required
            type="date"
            aria-label="거래 날짜"
            disabled={isEditingRecurring}
            value={transactionDate}
            onChange={(event) => {
              setDraft({
                ...draft,
                transactionAt: `${event.target.value}T${transactionTime}`,
              })
            }}
          />
          <Input
            required
            type="time"
            aria-label="거래 시간"
            disabled={isEditingRecurring}
            value={transactionTime}
            onChange={(event) =>
              setDraft({
                ...draft,
                transactionAt: `${transactionDate}T${event.target.value}`,
              })
            }
          />
        </DateTimeInputs>
      </Field>

      {draft.recurringType === "installment" &&
      !isEditingInstallment &&
      installmentScheduleSummary.length > 0 ? (
        <InstallmentScheduleCard>
          <strong>할부 일정</strong>
          <small>
            1회차는 구매일에 반영하고, 다음 달부터 카드 결제일에 반영합니다.
          </small>
          <InstallmentScheduleList>
            {installmentScheduleSummary.map((item, index) => (
              <li key={item.installmentNumber}>
                <span>
                  {item.installmentNumber}/{installmentMonths}회
                </span>
                <strong>{formatKoreanDate(item.date)}</strong>
                <small>
                  {item.installmentNumber === 1
                    ? "구매일 반영"
                    : "카드 결제 예정"}
                </small>
                {index === 2 && installmentSchedule.length > 4 ? (
                  <ScheduleEllipsis aria-hidden="true">···</ScheduleEllipsis>
                ) : null}
              </li>
            ))}
          </InstallmentScheduleList>
        </InstallmentScheduleCard>
      ) : null}

      <Field>
        {isSalaryIncome ? "근로자" : "행위자"}
        <Select
          value={draft.actorUserId}
          onChange={(event) =>
            setDraft({ ...draft, actorUserId: event.target.value })
          }
        >
          <option value="">공통</option>
          {store.currentMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.nickname}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        기준 카테고리
        <Select
          value={draft.categoryId}
          onChange={(event) => {
            const categoryId = event.target.value
            if (
              !isSplitCategory(
                store.currentCategories.find(
                  (category) => category.id === categoryId,
                ),
              )
            ) {
              setSplits([])
            }
            setDraft({ ...draft, categoryId })
          }}
        >
          <option value="">기본 카테고리 자동 적용</option>
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryLabel(category.id)}
            </option>
          ))}
        </Select>
      </Field>

      {draft.recurringType === "none" && splitCategorySelected ? (
        <SplitSection>
          <SplitHeader>
            <span>
              <strong>카테고리 분할</strong>
              <small>여러 항목을 한 번에 결제했을 때 사용합니다.</small>
            </span>
            <Button
              type="button"
              disabled={
                splits.length >= 10 || splitSelectableCategories.length === 0
              }
              onClick={() =>
                setSplits([
                  ...splits,
                  {
                    categoryId: splitSelectableCategories[0]?.id || "",
                    amount: "",
                  },
                ])
              }
            >
              <ListPlus size={14} /> 항목 추가
            </Button>
          </SplitHeader>
          {splits.map((split, index) => (
            <SplitRow key={`${index}-${split.categoryId}`}>
              <Select
                aria-label={`분할 ${index + 1} 카테고리`}
                value={split.categoryId}
                onChange={(event) =>
                  setSplits(
                    splits.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, categoryId: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                {splitSelectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category.id)}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`분할 ${index + 1} 금액`}
                inputMode="numeric"
                value={formatMoneyInput(split.amount)}
                onChange={(event) =>
                  setSplits(
                    splits.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            amount: event.target.value.replace(/\D/g, ""),
                          }
                        : item,
                    ),
                  )
                }
              />
              <IconButton
                type="button"
                title={`분할 ${index + 1} 삭제`}
                onClick={() =>
                  setSplits(
                    splits.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X size={15} />
              </IconButton>
            </SplitRow>
          ))}
          {splits.length > 0 ? (
            <SplitSummary $valid={splitsValid}>
              합계 {formatKrw(splitTotal)} / 거래 금액 {formatKrw(amount || 0)}
              {!splitsValid ? " · 합계와 거래 금액을 맞춰 주세요." : ""}
            </SplitSummary>
          ) : null}
        </SplitSection>
      ) : null}

      <Field>
        {merchantLabel}
        <Input
          value={draft.merchantName}
          onChange={(event) =>
            setDraft({ ...draft, merchantName: event.target.value })
          }
        />
      </Field>

      <Field>
        메모
        <Textarea
          value={draft.memo}
          onChange={(event) => setDraft({ ...draft, memo: event.target.value })}
        />
      </Field>

      {draft.recurringType === "none" ? (
        <Field>
          태그
          <Input
            value={tagsInput}
            maxLength={219}
            placeholder="예: 여행, 공동구매 (쉼표로 구분)"
            onChange={(event) => setTagsInput(event.target.value)}
          />
          <FieldHint>태그는 20자 이내로 최대 10개까지 저장됩니다.</FieldHint>
        </Field>
      ) : null}

      {possibleDuplicates.length > 0 ? (
        <DuplicateNotice role="alert">
          같은 금액·가맹점·15분 이내 거래가 {possibleDuplicates.length}건
          있습니다. 중복 등록인지 확인해 주세요.
        </DuplicateNotice>
      ) : null}

      <Button
        $variant="primary"
        disabled={!canSave || isSaving}
        onClick={() => void save()}
      >
        <Save size={16} />{" "}
        {isSaving ? "저장 중" : copySource ? "복사본 신규 등록" : "저장"}
      </Button>
    </Editor>
  )
})

function isValidDateInput(value: string): boolean {
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

const Editor = styled.div`
  display: grid;
  gap: 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panelSubtle};
  padding: 14px;
  margin-bottom: 16px;
`

const CardRequired = styled.span`
  color: ${colors.coral};
  font-size: 12px;
  font-weight: 600;
`

const EditPolicyNotice = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  color: ${colors.muted};
  padding: 10px 11px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.45;
`

const CopyNotice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid ${colors.focus};
  border-radius: ${radii.sm};
  background: ${colors.tealSoft};
  color: ${colors.ink};
  padding: 10px 11px;
  font-size: 12px;
  line-height: 1.45;

  svg {
    flex: 0 0 auto;
    margin-top: 1px;
    color: ${colors.teal};
  }
`

const ReceiptNotice = styled.div`
  display: grid;
  gap: 3px;
  border: 1px solid ${colors.teal};
  border-radius: ${radii.sm};
  background: ${colors.tealSoft};
  color: ${colors.ink};
  padding: 10px 11px;
  font-size: 11px;

  span,
  small {
    color: ${colors.muted};
  }
`

const DuplicateNotice = styled.div`
  border: 1px solid ${colors.amber};
  border-radius: ${radii.sm};
  background: ${colors.amberSoft};
  color: ${colors.amber};
  padding: 10px 11px;
  font-size: 11px;
`

const EditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`

const AmountControl = styled.div<{ $withType: boolean }>`
  display: grid;
  grid-template-columns: ${({ $withType }) =>
    $withType ? "130px minmax(0, 1fr)" : "minmax(0, 1fr)"};
  gap: 8px;
`

const DateTimeInputs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`

const SplitSection = styled.section`
  display: grid;
  gap: 8px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  padding: 10px;
`

const SplitHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  > span {
    display: grid;
    gap: 2px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
  }
`

const SplitRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 34px;
  gap: 7px;
`

const SplitSummary = styled.small<{ $valid: boolean }>`
  color: ${({ $valid }) => ($valid ? colors.muted : colors.coral)};
  font-size: 11px;
  font-weight: ${({ $valid }) => ($valid ? 500 : 700)};
`

const FieldHint = styled.small`
  color: ${colors.muted};
  font-size: 10px;
  font-weight: 400;
`

const InstallmentPreview = styled.small`
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 400;
`

const InstallmentScheduleCard = styled.section`
  display: grid;
  gap: 5px;
  border: 1px solid ${colors.focus};
  border-radius: ${radii.sm};
  background: ${colors.tealSoft};
  color: ${colors.ink};
  padding: 10px 11px;

  > strong {
    font-size: 12px;
  }

  > small {
    color: ${colors.muted};
    font-size: 10px;
    line-height: 1.4;
  }
`

const InstallmentScheduleList = styled.ul`
  display: grid;
  gap: 5px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    color: ${colors.muted};
    font-size: 10px;
  }

  li > span {
    color: ${colors.teal};
    font-weight: 750;
  }

  li > strong {
    color: ${colors.ink};
    font-size: 10px;
    font-weight: 650;
  }
`

const ScheduleEllipsis = styled.span`
  grid-column: 1 / -1;
  color: ${colors.muted} !important;
  text-align: center;
`

const FutureAmountScope = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border: 1px solid
    ${({ $checked }) => ($checked ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $checked }) => ($checked ? colors.tealSoft : colors.panel)};
  color: ${colors.ink};
  padding: 10px 11px;
  cursor: pointer;

  input {
    width: 15px;
    height: 15px;
    margin: 1px 0 0;
    accent-color: ${colors.teal};
  }

  span {
    display: grid;
    gap: 3px;
  }

  strong {
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 400;
  }
`

const IncomeRecurrenceCard = styled.div<{
  $checked?: boolean
  $interactive?: boolean
}>`
  min-height: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid
    ${({ $checked }) => ($checked ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $checked }) => ($checked ? colors.tealSoft : colors.panel)};
  color: ${colors.ink};
  padding: 8px 11px;
  cursor: ${({ $interactive }) => ($interactive ? "pointer" : "default")};

  input {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: ${colors.teal};
  }

  span {
    display: grid;
    gap: 2px;
    font-size: 12px;
    line-height: 1.35;
  }

  strong {
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 400;
  }
`
