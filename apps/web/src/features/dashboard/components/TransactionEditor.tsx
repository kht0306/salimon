"use client"

import styled from "@emotion/styled"
import { createTransactionRequestId } from "@salimon/api-client"
import { isSplitCategory } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Copy, Save, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useRef, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, IconButton } from "../styles"
import { TransactionDetailsFields } from "./TransactionDetailsFields"
import { TransactionPaymentFields } from "./TransactionPaymentFields"
import { TransactionTypeFields } from "./TransactionTypeFields"
import {
  getTransactionAtForSave,
  isInstallmentEditLocked,
  type TransactionEditorDraft,
  type TransactionSplitDraft,
} from "./transactionEditorDraft"

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
  const isSaving = store.transactionMutationState === "saving"
  const [tagsInput, setTagsInput] = useState(initialTagsInput)
  const [splits, setSplits] = useState(initialSplits)
  const initialTagsRef = useRef(initialTagsInput)
  const initialSplitsRef = useRef(initialSplits)
  const editorRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const requestIdRef = useRef<string | undefined>(undefined)
  if (!requestIdRef.current) {
    requestIdRef.current = createTransactionRequestId()
  }
  const [draft, setDraft] = useState(initialDraft)
  const initialDraftRef = useRef(initialDraft)
  const isEditingInstallment = isInstallmentEditLocked(editing)
  const isEditingFixed = editing?.recurringType === "fixed"

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

  useEffect(() => {
    requestIdRef.current = createTransactionRequestId()
  }, [draft, splits, tagsInput])

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
  const [transactionDate = "", transactionTimeValue = "12:00"] =
    draft.transactionAt.split("T")
  const transactionTime = transactionTimeValue.slice(0, 5)
  const installmentCard = store.currentCards.find(
    (card) => card.id === draft.paymentMethodId,
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
    if (isSaving) return
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
    try {
      const saved = await store.saveTransaction({
        id: editing?.id,
        requestId: requestIdRef.current,
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
        <IconButton title="닫기" disabled={isSaving} onClick={closeForm}>
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

      <TransactionTypeFields
        draft={draft}
        editing={editing}
        isEditingInstallment={isEditingInstallment}
        isEditingFixed={isEditingFixed}
        onDraftChange={setDraft}
        onSplitsChange={setSplits}
        onTagsInputChange={setTagsInput}
      />

      <TransactionPaymentFields
        draft={draft}
        editing={editing}
        isEditingInstallment={isEditingInstallment}
        isEditingFixed={isEditingFixed}
        onDraftChange={setDraft}
      />

      <TransactionDetailsFields
        draft={draft}
        amount={amount}
        splits={splits}
        splitsValid={splitsValid}
        splitTotal={splitTotal}
        tagsInput={tagsInput}
        onDraftChange={setDraft}
        onSplitsChange={setSplits}
        onTagsInputChange={setTagsInput}
      />

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
