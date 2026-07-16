"use client"

import styled from "@emotion/styled"
import {
  formatKoreanDate,
  formatMoneyInput,
  formatKrw,
  getDateTimeLocalValue,
  splitInstallmentPrincipal,
} from "@salimon/domain"
import type { CategoryUsageType, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Check,
  Copy,
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
  getInstallmentPaymentMethodId,
  isInstallmentEditLocked,
  type TransactionEditorDraft,
} from "./transactionEditorDraft"
import { TransactionMetadataChips } from "./TransactionMetadataChips"
import { groupTransactionsByActor } from "./transactionPresentation"

export const TransactionPanel = observer(function TransactionPanel() {
  const store = useAppStore()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [copySource, setCopySource] = useState<Transaction | null>(null)
  const [isAdding, setAdding] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const selectedDate = store.selectedDate
  const initialDraft = useMemo(
    () =>
      createNewTransactionDraft({
        selectedDate,
        expenseCategoryId: store.expenseCategories[0]?.id,
        actorUserId: store.authUser?.id,
        primaryPaymentMethodId: store.currentUserPrimaryCard?.id,
      }),
    [
      selectedDate,
      store.expenseCategories,
      store.authUser?.id,
      store.currentUserPrimaryCard?.id,
    ],
  )

  const [draft, setDraft] = useState(initialDraft)
  const initialDraftRef = useRef(initialDraft)
  const isEditingInstallment = isInstallmentEditLocked(editing)

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
      JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current)
    store.setTransactionEditorDirty(dirty)
  }, [draft, isAdding, store, store.transactionEditorOpen])

  const amount = Number(draft.amount)
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
    (draft.recurringType !== "installment" ||
      (Number.isSafeInteger(installmentMonths) &&
        installmentMonths >= 2 &&
        installmentMonths <= 120 &&
        Boolean(draft.paymentMethodId) &&
        store.currentCards.length > 0 &&
        (isEditingInstallment ||
          draft.installmentAmountType !== "principal" ||
          amount >= installmentMonths)))
  const transactionGroups = store.separateTransactionsByUser
    ? groupTransactionsByActor(
        store.calendarSelectedDateTransactions,
        store.currentMembers,
      )
    : [
        {
          key: "all",
          label: "",
          transactions: store.calendarSelectedDateTransactions,
        },
      ]

  function openNew() {
    initialDraftRef.current = initialDraft
    setEditing(null)
    setCopySource(null)
    setDraft(initialDraft)
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
      applyAmountToFuture: true,
    }
    initialDraftRef.current = editDraft
    setEditing(transaction)
    setCopySource(null)
    setDraft(editDraft)
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
  }

  function openCopy(transaction: Transaction) {
    const validCategories = store.currentCategories.filter((category) =>
      category.usageTypes.includes(transaction.type as CategoryUsageType),
    )
    const fallbackCategoryId = validCategories[0]?.id
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
    setEditing(null)
    setCopySource(transaction)
    setDraft(copyDraft)
    setAdding(true)
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
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

    savingRef.current = true
    setSaving(true)
    try {
      const saved = await store.saveTransaction({
        id: editing?.id,
        ledgerId: store.selectedLedgerId,
        type: draft.type as Transaction["type"],
        status: draft.status as "pending" | "confirmed" | "excluded",
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
        applyAmountToFuture: draft.applyAmountToFuture,
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
        <div>
          <PanelTitle>{formatKoreanDate(store.selectedDate)}</PanelTitle>
          <Subtle>{store.calendarSelectedDateTransactions.length}건</Subtle>
        </div>
        <HeaderActions>
          <GroupToggle $active={store.separateTransactionsByUser}>
            <input
              type="checkbox"
              checked={store.separateTransactionsByUser}
              onChange={(event) =>
                store.setSeparateTransactionsByUser(event.target.checked)
              }
            />
            <UsersRound size={14} /> 사용자 구분
          </GroupToggle>
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

          <TwoColumns>
            <Field>
              <span>
                유형<RequiredMark>*</RequiredMark>
              </span>
              <Select
                required
                value={draft.type}
                disabled={isEditingInstallment}
                onChange={(event) => {
                  const type = event.target.value as Transaction["type"]
                  setDraft({
                    ...draft,
                    type,
                    categoryId:
                      store.currentCategories.find((category) =>
                        category.usageTypes.includes(type as CategoryUsageType),
                      )?.id ?? "",
                    recurringType:
                      type !== "expense" &&
                      draft.recurringType === "installment"
                        ? "none"
                        : draft.recurringType,
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
                <option value="pending">대기</option>
                <option value="excluded">제외</option>
              </Select>
            </Field>
          </TwoColumns>

          <TwoColumns>
            <Field>
              반복 유형
              <Select
                value={draft.recurringType}
                disabled={isEditingInstallment}
                onChange={(event) => {
                  const recurringType = event.target
                    .value as TransactionEditorDraft["recurringType"]
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
                <option value="fixed">고정비</option>
                <option value="installment" disabled={draft.type !== "expense"}>
                  카드 할부
                </option>
              </Select>
            </Field>
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
            ) : (
              <div />
            )}
          </TwoColumns>

          {isEditingInstallment ? (
            <EditPolicyNotice role="status">
              할부 거래는 거래 유형, 반복 유형, 할부 개월, 결제 수단, 거래일시를
              변경할 수 없습니다. 금액은 선택한 회차 기준으로 수정됩니다.
            </EditPolicyNotice>
          ) : editing &&
            draft.recurringType !== (editing.recurringType ?? "none") ? (
            <EditPolicyNotice role="status">
              반복 유형 변경은 선택한 거래부터 이후 거래에 적용됩니다.
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
                  const memberMethods = (
                    draft.type === "saving"
                      ? store.currentAccounts
                      : draft.recurringType === "installment"
                        ? store.currentCards
                        : store.currentPaymentMethods
                  )
                    .filter((method) => method.ownerUserId === member.userId)
                    .sort(
                      (a, b) =>
                        Number(Boolean(b.isPrimary)) -
                          Number(Boolean(a.isPrimary)) ||
                        Number(a.type === "bank") - Number(b.type === "bank") ||
                        a.name.localeCompare(b.name, "ko"),
                    )
                  return memberMethods.length > 0 ? (
                    <optgroup key={member.userId} label={member.nickname}>
                      {memberMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.isPrimary ? "[주 카드] " : ""}
                          {method.type === "bank" ? "계좌" : "카드"} ·{" "}
                          {method.issuer} · {method.name}
                          {method.last4 ? ` (${method.last4})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                })}
              </Select>
              {draft.recurringType === "installment" &&
              store.currentCards.length === 0 ? (
                <CardRequired role="alert">
                  카드 관리 메뉴에서 카드를 먼저 등록해 주세요.
                </CardRequired>
              ) : null}
              {draft.type === "saving" && store.currentAccounts.length === 0 ? (
                <CardRequired role="alert">
                  계좌 관리 메뉴에서 계좌를 먼저 등록해 주세요.
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

          {editing?.recurringType === "fixed" || isEditingInstallment ? (
            <FutureAmountScope $checked={draft.applyAmountToFuture}>
              <input
                type="checkbox"
                checked={draft.applyAmountToFuture}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    applyAmountToFuture: event.target.checked,
                  })
                }
              />
              <span>
                <strong>변경 금액을 이 달 이후 거래에도 적용</strong>
                <small>
                  {draft.applyAmountToFuture
                    ? "이전 달 거래는 유지하고 선택한 달부터 반영합니다."
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
                disabled={isEditingInstallment}
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
                disabled={isEditingInstallment}
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
            행위자
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
              onChange={(event) =>
                setDraft({ ...draft, categoryId: event.target.value })
              }
            >
              <option value="">기본 카테고리 자동 적용</option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            가맹점/내용
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
        {transactionGroups.map((group) => (
          <TransactionGroup key={group.key}>
            {store.separateTransactionsByUser ? (
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
              const registrant =
                store.currentMembers.find(
                  (member) => member.userId === transaction.createdBy,
                )?.nickname ?? "알 수 없음"
              const actor = transaction.actorUserId
                ? (store.currentMembers.find(
                    (member) => member.userId === transaction.actorUserId,
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
                    />
                    <Amount $type={transaction.type}>
                      {formatKrw(transaction.amount)}
                    </Amount>
                  </TransactionTop>
                  <TransactionBody>
                    <TransactionName>
                      {transaction.merchantName || transaction.memo || "거래"}
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
                      <CompactAction
                        $variant="danger"
                        title={
                          transaction.recurringType === "fixed"
                            ? "이번 달부터 고정비 제거"
                            : "삭제"
                        }
                        onClick={() =>
                          transaction.recurringType === "fixed" &&
                          transaction.recurringRuleId
                            ? void store.deactivateFixedRule(
                                transaction.recurringRuleId,
                              )
                            : void store.softDeleteTransaction(transaction.id)
                        }
                      >
                        <Trash2 size={14} />
                      </CompactAction>
                    </ActionCluster>
                  </TransactionFooter>
                </TransactionItem>
              )
            })}
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
            -
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "expense" && item.status !== "excluded",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SummaryRow>
          <span>수입 합계</span>
          <SummaryAmount $tone="income">
            +
            {formatKrw(
              store.calendarSelectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "income" && item.status !== "excluded",
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
                    item.type === "saving" && item.status !== "excluded",
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
                .filter((item) => item.status !== "excluded")
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
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
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

const GroupToggle = styled.label<{ $active: boolean }>`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${({ $active }) => ($active ? colors.focus : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $active }) => ($active ? colors.tealSoft : "#fff")};
  color: ${({ $active }) => ($active ? colors.teal : colors.muted)};
  padding: 0 9px;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;

  input {
    width: 13px;
    height: 13px;
    margin: 0;
    accent-color: ${colors.teal};
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
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 8px;
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
  background: ${({ $checked }) => ($checked ? colors.tealSoft : "#fff")};
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

const TransactionList = styled.div`
  display: grid;
`

const TransactionGroup = styled.section`
  display: grid;
`

const TransactionGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${colors.borderStrong};
  background: ${colors.panelSubtle};
  color: ${colors.ink};
  padding: 8px 9px;
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
