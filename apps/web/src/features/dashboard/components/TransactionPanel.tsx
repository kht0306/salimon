"use client"

import styled from "@emotion/styled"
import {
  findOtherCategory,
  formatKoreanDate,
  formatMoneyInput,
  formatKrw,
  getDateTimeLocalValue,
  isSplitCategory,
  splitInstallmentPrincipal,
} from "@salimon/domain"
import type { TransactionGrouping } from "@salimon/store"
import type {
  CategoryUsageType,
  ReceiptParseResult,
  Transaction,
} from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Check,
  ChevronDown,
  CircleStop,
  Copy,
  ListPlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  UsersRound,
  X,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  IconButton,
  Input,
  PanelTitle,
  RequiredMark,
  Select,
  SidePanel,
  Textarea,
} from "../styles"
import {
  canCopyTransaction,
  createCopiedTransactionDraft,
  createNewTransactionDraft,
  getIncomeRecurringType,
  getInstallmentPaymentMethodId,
  isInstallmentEditLocked,
  type TransactionEditorDraft,
} from "./transactionEditorDraft"
import { TransactionMetadataChips } from "./TransactionMetadataChips"
import { ReceiptImporter } from "./ReceiptImporter"
import {
  getPaymentMethodTypeLabel,
  groupTransactionsByActor,
  groupTransactionsByRecurrence,
  groupTransactionsByRegistrant,
  sortPaymentMethodsForSelection,
} from "./transactionPresentation"

export const TransactionPanel = observer(function TransactionPanel() {
  const store = useAppStore()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [copySource, setCopySource] = useState<Transaction | null>(null)
  const [isAdding, setAdding] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [receiptWarnings, setReceiptWarnings] = useState<string[]>([])
  const [tagsInput, setTagsInput] = useState("")
  const [splits, setSplits] = useState<
    Array<{ categoryId: string; amount: string }>
  >([])
  const initialTagsRef = useRef("")
  const initialSplitsRef = useRef<Array<{ categoryId: string; amount: string }>>(
    [],
  )
  const editorRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const selectedDate = store.selectedDate
  const initialDraft = useMemo(
    () =>
      createNewTransactionDraft({
        selectedDate,
        expenseCategoryId: findOtherCategory(
          store.expenseCategories,
          store.selectedLedgerId,
        )?.id,
        actorUserId: store.authUser?.id,
        primaryPaymentMethodId: store.currentUserPrimaryCard?.id,
      }),
    [
      selectedDate,
      store.selectedLedgerId,
      store.expenseCategories,
      store.authUser?.id,
      store.currentUserPrimaryCard?.id,
    ],
  )

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

  useEffect(
    () => () => {
      store.setTransactionEditorOpen(false)
    },
    [store],
  )

  useEffect(() => {
    if (!isAdding || !store.transactionEditorOpen) return

    editorRef.current?.scrollIntoView({ block: "start" })
  }, [copySource, editing, isAdding, store.transactionEditorOpen])

  useEffect(() => {
    const dirty =
      store.transactionEditorOpen &&
      isAdding &&
      (JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current) ||
        tagsInput !== initialTagsRef.current ||
        JSON.stringify(splits) !== JSON.stringify(initialSplitsRef.current))
    store.setTransactionEditorDirty(dirty)
  }, [draft, isAdding, splits, store, store.transactionEditorOpen, tagsInput])

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
  const selectableCategories = store.currentCategories.filter((category) =>
    category.usageTypes.includes(draft.type as CategoryUsageType),
  )
  const splitSelectableCategories = selectableCategories.filter(
    (category) => !isSplitCategory(category),
  )
  const categoryLabel = (categoryId: string): string => {
    const category = store.currentCategories.find(
      (item) => item.id === categoryId,
    )
    const parent = category?.parentCategoryId
      ? store.currentCategories.find(
          (item) => item.id === category.parentCategoryId,
        )
      : undefined
    return category
      ? `${parent ? `${parent.name} › ` : ""}${category.name}`
      : "삭제된 카테고리"
  }
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
  const recurrenceGroups = groupTransactionsByRecurrence(
    store.calendarSelectedDateTransactions,
  ).map((recurrenceGroup) => ({
    ...recurrenceGroup,
    userGroups:
      store.transactionGrouping === "actor"
        ? groupTransactionsByActor(
            recurrenceGroup.transactions,
            store.currentMembers,
          )
        : store.transactionGrouping === "registrant"
          ? groupTransactionsByRegistrant(
              recurrenceGroup.transactions,
              store.currentMembers,
            )
          : [
              {
                key: "all",
                label: "",
                transactions: recurrenceGroup.transactions,
              },
            ],
  }))

  function openNew() {
    initialDraftRef.current = initialDraft
    setEditing(null)
    setCopySource(null)
    setDraft(initialDraft)
    setReceiptWarnings([])
    initialTagsRef.current = ""
    initialSplitsRef.current = []
    setTagsInput("")
    setSplits([])
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
  }

  function openEdit(transaction: Transaction) {
    const recurringRule = transaction.recurringRuleId
      ? store.data.recurringRules.find(
          (rule) => rule.id === transaction.recurringRuleId,
        )
      : undefined
    const firstInstallment = transaction.recurringRuleId
      ? store.data.transactions.find(
          (item) =>
            item.recurringRuleId === transaction.recurringRuleId &&
            item.installmentNumber === 1 &&
            !item.deletedAt,
        )
      : undefined
    const editDraft: TransactionEditorDraft = {
      amount: String(transaction.amount),
      merchantName: transaction.merchantName ?? "",
      memo: transaction.memo ?? "",
      type: transaction.type,
      incomeKind:
        transaction.type === "income"
          ? (transaction.incomeKind ?? "side_income")
          : undefined,
      status: transaction.status,
      categoryId: transaction.categoryId ?? "",
      actorUserId: transaction.actorUserId ?? "",
      recurringType: transaction.recurringType ?? "none",
      recurringRuleId: transaction.recurringRuleId,
      installmentMonths: String(transaction.installmentTotal ?? 2),
      installmentAmountType: recurringRule?.installmentAmountType ?? "monthly",
      paymentMethodId:
        transaction.paymentMethodId ?? recurringRule?.paymentMethodId ?? "",
      transactionAt: getDateTimeLocalValue(
        recurringRule?.purchaseAt ??
          firstInstallment?.transactionAt ??
          transaction.transactionAt,
      ),
      applyChangesToFuture: true,
      sourceType: transaction.sourceType,
      parseConfidence: transaction.parseConfidence,
    }
    const editTags = (transaction.tags ?? []).join(", ")
    const editSplits = store.data.transactionSplits
      .filter((split) => split.transactionId === transaction.id)
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((split) => ({
        categoryId: split.categoryId,
        amount: String(split.amount),
      }))
    initialDraftRef.current = editDraft
    initialTagsRef.current = editTags
    initialSplitsRef.current = editSplits
    setEditing(transaction)
    setCopySource(null)
    setDraft(editDraft)
    setReceiptWarnings([])
    setTagsInput(editTags)
    setSplits(editSplits)
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
  }

  function openCopy(transaction: Transaction) {
    const validCategories = store.currentCategories.filter((category) =>
      category.usageTypes.includes(transaction.type as CategoryUsageType),
    )
    const fallbackCategoryId = findOtherCategory(
      validCategories,
      store.selectedLedgerId,
    )?.id
    const copyDraft = createCopiedTransactionDraft({
      transaction,
      fallbackCategoryId,
      fallbackActorUserId: store.authUser?.id,
      activeCategoryIds: new Set(
        validCategories.map((category) => category.id),
      ),
      activeMemberIds: new Set(
        store.currentMembers.map((member) => member.userId),
      ),
      activePaymentMethodIds: new Set(
        store.currentPaymentMethods.map((method) => method.id),
      ),
      primaryPaymentMethodId: store.currentUserPrimaryCard?.id,
    })

    initialDraftRef.current = copyDraft
    const copyTags = (transaction.tags ?? []).join(", ")
    initialTagsRef.current = copyTags
    initialSplitsRef.current = []
    setEditing(null)
    setCopySource(transaction)
    setDraft(copyDraft)
    setReceiptWarnings([])
    setTagsInput(copyTags)
    setSplits([])
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
  }

  function applyReceipt(result: ReceiptParseResult) {
    const category =
      store.expenseCategories.find(
        (item) =>
          item.name.toLowerCase() === result.categoryHint?.toLowerCase(),
      ) ?? findOtherCategory(store.expenseCategories, store.selectedLedgerId)
    const paymentMethod = result.paymentLast4
      ? store.currentPaymentMethods.find(
          (item) => item.last4 === result.paymentLast4,
        )
      : undefined
    const nextDraft: TransactionEditorDraft = {
      ...initialDraft,
      amount: String(result.amount),
      merchantName: result.merchantName,
      memo: result.memo ?? "",
      categoryId: category?.id ?? "",
      paymentMethodId: paymentMethod?.id ?? initialDraft.paymentMethodId,
      transactionAt: getDateTimeLocalValue(result.transactionAt),
      sourceType: "receipt_ai",
      parseConfidence: result.confidence,
    }
    initialDraftRef.current = nextDraft
    initialTagsRef.current = ""
    initialSplitsRef.current = []
    setEditing(null)
    setCopySource(null)
    setDraft(nextDraft)
    setReceiptWarnings(result.warnings)
    setTagsInput("")
    setSplits([])
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
    store.notify(
      "영수증을 읽었습니다. 금액과 거래일을 확인한 뒤 저장해 주세요.",
      "info",
    )
  }

  function closeForm() {
    setAdding(false)
    setEditing(null)
    setCopySource(null)
    store.setTransactionEditorOpen(false)
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
        transactionAt: draft.transactionAt,
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
    <SidePanel>
      <PanelTop>
        <DateSummary>
          <DateTitle>{formatKoreanDate(store.selectedDate)}</DateTitle>
          <Subtle>{store.calendarSelectedDateTransactions.length}건</Subtle>
        </DateSummary>
        <HeaderActions>
          <GroupingControl title="거래 목록 구분 기준">
            <UsersRound size={14} aria-hidden="true" />
            <GroupingSelect
              aria-label="거래 목록 구분 기준"
              value={store.transactionGrouping}
              onChange={(event) =>
                store.setTransactionGrouping(
                  event.target.value as TransactionGrouping,
                )
              }
            >
              <option value="actor">거래자 구분</option>
              <option value="registrant">등록자 구분</option>
              <option value="none">구분 없음</option>
            </GroupingSelect>
          </GroupingControl>
          <IconButton
            $variant="primary"
            title="거래 추가"
            onClick={openNew}
            disabled={!store.authUser || !store.selectedLedgerId}
          >
            <Plus size={17} />
          </IconButton>
        </HeaderActions>
      </PanelTop>

      <ReceiptImportArea>
        <ReceiptImporter
          disabled={!store.authUser || !store.selectedLedgerId}
          onApply={applyReceipt}
        />
      </ReceiptImportArea>

      {isAdding && store.transactionEditorOpen ? (
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
                정확도 {Math.round((draft.parseConfidence ?? 0) * 100)}% ·
                금액, 거래일시, 가맹점을 반드시 확인해 주세요.
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
                  <option
                    value="installment"
                    disabled={draft.type !== "expense"}
                  >
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
                  draft.type === "saving" ||
                  draft.recurringType === "installment"
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
              {draft.recurringType === "installment" &&
              !isEditingInstallment ? (
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
                월 {formatKrw(installmentMonthlyAmount)} · 마지막 회차에 잔액
                반영
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
              거래일시<RequiredMark>*</RequiredMark>
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
                    splits.length >= 10 ||
                    splitSelectableCategories.length === 0
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
              onChange={(event) =>
                setDraft({ ...draft, memo: event.target.value })
              }
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
      ) : null}

      <TransactionList>
        {recurrenceGroups.map((recurrenceGroup) => (
          <TransactionGroup key={recurrenceGroup.key}>
            <RecurrenceGroupHeader
              type="button"
              $recurring={recurrenceGroup.key === "recurring"}
              $collapsed={store.collapsedTransactionGroupKeys.has(
                recurrenceGroup.key,
              )}
              aria-expanded={
                !store.collapsedTransactionGroupKeys.has(recurrenceGroup.key)
              }
              onClick={() => store.toggleTransactionGroup(recurrenceGroup.key)}
            >
              <span>{recurrenceGroup.label}</span>
              <GroupHeaderMeta>
                <small>{recurrenceGroup.transactions.length}건</small>
                <ChevronDown size={14} aria-hidden="true" />
              </GroupHeaderMeta>
            </RecurrenceGroupHeader>
            {!store.collapsedTransactionGroupKeys.has(recurrenceGroup.key)
              ? recurrenceGroup.userGroups.map((group) => (
                  <UserGroup key={`${recurrenceGroup.key}-${group.key}`}>
                    {store.transactionGrouping !== "none" ? (
                      <TransactionGroupHeader>
                        <span>{group.label}</span>
                        <small>{group.transactions.length}건</small>
                      </TransactionGroupHeader>
                    ) : null}
                    {group.transactions.map((transaction) => {
                      const category = store.data.categories.find(
                        (item) => item.id === transaction.categoryId,
                      )
                      const paymentMethod = store.data.paymentMethods.find(
                        (item) => item.id === transaction.paymentMethodId,
                      )
                      const splitCategories = store.data.transactionSplits
                        .filter(
                          (split) => split.transactionId === transaction.id,
                        )
                        .sort(
                          (first, second) => first.sortOrder - second.sortOrder,
                        )
                        .flatMap((split) => {
                          const splitCategory = store.data.categories.find(
                            (item) => item.id === split.categoryId,
                          )
                          return splitCategory ? [splitCategory] : []
                        })
                      const registrant =
                        store.currentMembers.find(
                          (member) => member.userId === transaction.createdBy,
                        )?.nickname ?? "알 수 없음"
                      const actor = transaction.actorUserId
                        ? (store.currentMembers.find(
                            (member) =>
                              member.userId === transaction.actorUserId,
                          )?.nickname ?? registrant)
                        : "공통"
                      return (
                        <TransactionItem
                          key={transaction.id}
                          $excluded={transaction.status === "excluded"}
                        >
                          <TransactionTop>
                            <TransactionMetadataChips
                              transaction={transaction}
                              category={category}
                              paymentMethod={paymentMethod}
                              splitCategories={splitCategories}
                            />
                            <Amount $type={transaction.type}>
                              {formatKrw(transaction.amount)}
                            </Amount>
                          </TransactionTop>
                          <TransactionBody>
                            <TransactionName>
                              {transaction.merchantName ||
                                transaction.memo ||
                                "거래"}
                            </TransactionName>
                            {transaction.memo ? (
                              <TransactionMemo title={transaction.memo}>
                                {transaction.memo}
                              </TransactionMemo>
                            ) : null}
                          </TransactionBody>
                          <TransactionFooter>
                            <AuditInfo>
                              <span>거래 {actor}</span>
                              <span>등록 {registrant}</span>
                              <time dateTime={transaction.createdAt}>
                                {new Date(transaction.createdAt).toLocaleString(
                                  "ko-KR",
                                  {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  },
                                )}
                              </time>
                            </AuditInfo>
                            <ActionCluster>
                              {canCopyTransaction(transaction) ? (
                                <CompactAction
                                  title="복사하여 신규 등록"
                                  onClick={() => openCopy(transaction)}
                                >
                                  <Copy size={14} />
                                </CompactAction>
                              ) : null}
                              <CompactAction
                                title="수정"
                                onClick={() => openEdit(transaction)}
                              >
                                <Pencil size={14} />
                              </CompactAction>
                              {transaction.recurringType === "fixed" &&
                              transaction.recurringRuleId ? (
                                <CompactAction
                                  title="이번 달까지만 유지하고 반복 종료"
                                  aria-label="이번 달까지만 유지하고 반복 종료"
                                  onClick={() =>
                                    void store.endFixedRule(
                                      transaction.recurringRuleId!,
                                      "next",
                                    )
                                  }
                                >
                                  <CircleStop size={14} />
                                </CompactAction>
                              ) : null}
                              <CompactAction
                                $variant="danger"
                                aria-label={
                                  transaction.recurringType === "fixed"
                                    ? "이번 달부터 고정 거래와 반복 종료"
                                    : "삭제"
                                }
                                title={
                                  transaction.recurringType === "fixed"
                                    ? "이번 달부터 고정 거래와 반복 종료"
                                    : "삭제"
                                }
                                onClick={() => {
                                  if (
                                    transaction.recurringType === "fixed" &&
                                    transaction.recurringRuleId
                                  ) {
                                    if (
                                      window.confirm(
                                        "이번 달 거래와 이후 반복 거래를 모두 종료할까요?",
                                      )
                                    ) {
                                      void store.endFixedRule(
                                        transaction.recurringRuleId,
                                        "current",
                                      )
                                    }
                                    return
                                  }
                                  void store.softDeleteTransaction(
                                    transaction.id,
                                  )
                                }}
                              >
                                <Trash2 size={14} />
                              </CompactAction>
                            </ActionCluster>
                          </TransactionFooter>
                        </TransactionItem>
                      )
                    })}
                  </UserGroup>
                ))
              : null}
          </TransactionGroup>
        ))}
      </TransactionList>

      {store.calendarSelectedDateTransactions.length === 0 ? (
        <Empty>
          <Check size={20} />
          <span>등록된 거래 없음</span>
        </Empty>
      ) : null}

      <DailySummary>
        <SummaryRow>
          <span>지출 합계</span>
          <SummaryAmount $tone="expense">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "expense" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SummaryRow>
          <span>수입 합계</span>
          <SummaryAmount $tone="income">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "income" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SummaryRow>
          <span>저축 합계</span>
          <SummaryAmount $tone="saving">
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "saving" && item.status === "confirmed",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SettlementRow>
          <span>정산 합계</span>
          <strong>
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter((item) => item.status === "confirmed")
                .reduce(
                  (sum, item) =>
                    sum +
                    (item.type === "income"
                      ? item.amount
                      : item.type === "expense"
                        ? -item.amount
                        : 0),
                  0,
                ),
            )}
          </strong>
        </SettlementRow>
      </DailySummary>
    </SidePanel>
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

const PanelTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
`

const DateSummary = styled.div`
  flex: 0 0 auto;
  min-width: max-content;
`

const DateTitle = styled(PanelTitle)`
  white-space: nowrap;
`

const Subtle = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  margin-top: 4px;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`

const ReceiptImportArea = styled.div`
  display: flex;
  justify-content: flex-end;
  margin: -3px 0 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
`

const GroupingControl = styled.label`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  color: ${colors.muted};
  padding: 0 5px 0 7px;
  font-size: 11px;
  font-weight: 650;

  svg {
    color: ${colors.teal};
  }
`

const GroupingSelect = styled.select`
  height: 26px;
  border: 0;
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  color: ${colors.ink};
  padding: 0 5px;
  font: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: 1px;
  }
`

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

const FutureAmountScope = styled.label<{ $checked: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border: 1px solid
    ${({ $checked }) => ($checked ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $checked }) =>
    $checked ? colors.tealSoft : colors.panel};
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
  background: ${({ $checked }) =>
    $checked ? colors.tealSoft : colors.panel};
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

const TransactionList = styled.div`
  display: grid;
`

const TransactionGroup = styled.section`
  display: grid;
`

const UserGroup = styled.div`
  display: grid;
`

const RecurrenceGroupHeader = styled.button<{
  $recurring: boolean
  $collapsed: boolean
}>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-bottom: 1px solid ${colors.borderStrong};
  background: ${({ $recurring }) =>
    $recurring ? colors.tealSoft : colors.panelSubtle};
  color: ${({ $recurring }) => ($recurring ? colors.teal : colors.ink)};
  padding: 9px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 750;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: -2px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 600;
  }

  svg {
    transition: transform 160ms ease;
    transform: rotate(${({ $collapsed }) => ($collapsed ? "-90deg" : "0")});
  }
`

const GroupHeaderMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
`

const TransactionGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${colors.borderStrong};
  background: ${colors.panel};
  color: ${colors.ink};
  padding: 7px 9px 7px 18px;
  font-size: 11px;
  font-weight: 700;

  small {
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 600;
  }
`

const TransactionItem = styled.article<{ $excluded: boolean }>`
  display: grid;
  gap: 9px;
  min-height: 126px;
  border-bottom: 1px solid ${colors.border};
  padding: 12px 0;
  opacity: ${({ $excluded }) => ($excluded ? 0.52 : 1)};

  &:hover > footer > div:last-of-type,
  &:focus-within > footer > div:last-of-type {
    opacity: 1;
  }
`

const TransactionTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`

const TransactionBody = styled.div`
  min-width: 0;
`

const TransactionName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
`

const TransactionMemo = styled.div`
  margin-top: 4px;
  color: ${colors.muted};
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Amount = styled.div<{ $type: Transaction["type"] }>`
  color: ${({ $type }) =>
    $type === "income"
      ? colors.green
      : $type === "expense"
        ? colors.coral
        : $type === "saving"
          ? colors.violet
          : colors.blue};
  font-family: var(--font-geist-mono);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
`

const TransactionFooter = styled.footer`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
`

const AuditInfo = styled.div`
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  color: ${colors.subtle};
  font-size: 9px;

  span,
  time {
    white-space: nowrap;
  }
`

const ActionCluster = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 140ms ease;

  @media (hover: none) {
    opacity: 1;
  }
`

const CompactAction = styled(IconButton)`
  width: 28px;
  min-height: 28px;
  border-color: ${colors.border};
`

const Empty = styled.div`
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: ${colors.muted};
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
`

const DailySummary = styled.section`
  position: sticky;
  z-index: 2;
  bottom: 0;
  display: grid;
  gap: 7px;
  margin-top: 16px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: 0 -10px 20px rgba(24, 24, 27, 0.08);
  padding: 12px;
`

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${colors.muted};
  font-size: 12px;
`

const SummaryAmount = styled.strong<{
  $tone: "expense" | "income" | "saving"
}>`
  color: ${({ $tone }) =>
    $tone === "expense"
      ? colors.coral
      : $tone === "saving"
        ? colors.violet
        : colors.green};
  font-family: var(--font-geist-mono);
`

const SettlementRow = styled(SummaryRow)`
  margin-top: 3px;
  border-top: 1px solid ${colors.border};
  padding-top: 9px;
  color: ${colors.ink};
  font-weight: 700;

  strong {
    font-family: var(--font-geist-mono);
  }
`
