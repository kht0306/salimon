"use client"

import styled from "@emotion/styled"
import {
  findOtherCategory,
  formatKoreanDate,
  getDateTimeLocalValue,
} from "@salimon/domain"
import type { TransactionGrouping } from "@salimon/store"
import type {
  CategoryUsageType,
  ReceiptParseResult,
  Transaction,
} from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Plus, UsersRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { IconButton, PanelTitle, SidePanel } from "../styles"
import {
  TransactionEditor,
  type TransactionEditorSession,
} from "./TransactionEditor"
import { TransactionHistory } from "./TransactionHistory"
import { ReceiptImporter } from "./ReceiptImporter"
import {
  createCopiedTransactionDraft,
  createNewTransactionDraft,
  type TransactionEditorDraft,
} from "./transactionEditorDraft"

type TransactionEditorSessionInput = Omit<TransactionEditorSession, "id">

export const TransactionPanel = observer(function TransactionPanel() {
  const store = useAppStore()
  const [editorSession, setEditorSession] =
    useState<TransactionEditorSession | null>(null)
  const editorSessionIdRef = useRef(0)
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

  useEffect(
    () => () => {
      store.setTransactionEditorOpen(false)
    },
    [store],
  )

  function openEditor(session: TransactionEditorSessionInput) {
    editorSessionIdRef.current += 1
    setEditorSession({ id: editorSessionIdRef.current, ...session })
    store.setTransactionEditorDirty(false)
    store.setTransactionEditorOpen(true)
  }

  function openNew() {
    openEditor({
      editing: null,
      copySource: null,
      initialDraft,
      receiptWarnings: [],
      initialTagsInput: "",
      initialSplits: [],
    })
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

    openEditor({
      editing: transaction,
      copySource: null,
      initialDraft: editDraft,
      receiptWarnings: [],
      initialTagsInput: editTags,
      initialSplits: editSplits,
    })
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
    const copyTags = (transaction.tags ?? []).join(", ")

    openEditor({
      editing: null,
      copySource: transaction,
      initialDraft: copyDraft,
      receiptWarnings: [],
      initialTagsInput: copyTags,
      initialSplits: [],
    })
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

    openEditor({
      editing: null,
      copySource: null,
      initialDraft: nextDraft,
      receiptWarnings: result.warnings,
      initialTagsInput: "",
      initialSplits: [],
    })
    store.notify(
      "영수증을 읽었습니다. 금액과 거래일을 확인한 뒤 저장해 주세요.",
      "info",
    )
  }

  function closeEditor() {
    setEditorSession(null)
    store.setTransactionEditorOpen(false)
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

      {editorSession && store.transactionEditorOpen ? (
        <TransactionEditor
          key={editorSession.id}
          session={editorSession}
          onClose={closeEditor}
        />
      ) : null}

      <TransactionHistory onCopy={openCopy} onEdit={openEdit} />
    </SidePanel>
  )
})

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
