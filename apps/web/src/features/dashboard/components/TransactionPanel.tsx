"use client"

import styled from "@emotion/styled"
import { formatKoreanDate, formatKoreanTime, formatKrw, getDateTimeLocalValue } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Field, IconButton, Input, PanelTitle, Select, SidePanel, Textarea } from "../styles"

export const TransactionPanel = observer(function TransactionPanel() {
  const store = useAppStore()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [isAdding, setAdding] = useState(false)
  const selectedDate = store.selectedDate
  const initialDraft = useMemo(
    () => ({
      amount: "",
      merchantName: "",
      memo: "",
      type: "expense",
      status: "confirmed",
      categoryId: store.expenseCategories[0]?.id ?? "",
      transactionAt: `${selectedDate}T12:00`,
    }),
    [selectedDate, store.expenseCategories],
  )

  const [draft, setDraft] = useState(initialDraft)

  function openNew() {
    setEditing(null)
    setDraft(initialDraft)
    setAdding(true)
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction)
    setDraft({
      amount: String(transaction.amount),
      merchantName: transaction.merchantName ?? "",
      memo: transaction.memo ?? "",
      type: transaction.type,
      status: transaction.status,
      categoryId: transaction.categoryId ?? "",
      transactionAt: getDateTimeLocalValue(transaction.transactionAt),
    })
    setAdding(true)
  }

  function closeForm() {
    setAdding(false)
    setEditing(null)
  }

  async function save() {
    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    const saved = await store.saveTransaction({
      id: editing?.id,
      ledgerId: store.selectedLedgerId,
      type: draft.type as "expense" | "income" | "transfer",
      status: draft.status as "pending" | "confirmed" | "excluded",
      amount,
      transactionAt: draft.transactionAt,
      categoryId: draft.categoryId || undefined,
      merchantName: draft.merchantName || undefined,
      memo: draft.memo || undefined,
    })
    if (saved) {
      closeForm()
    }
  }

  return (
    <SidePanel>
      <PanelTop>
        <div>
          <PanelTitle>{formatKoreanDate(store.selectedDate)}</PanelTitle>
          <Subtle>{store.selectedDateTransactions.length}건</Subtle>
        </div>
        <IconButton $variant="primary" title="거래 추가" onClick={openNew} disabled={!store.authUser || !store.selectedLedgerId}>
          <Plus size={17} />
        </IconButton>
      </PanelTop>

      {isAdding ? (
        <Editor>
          <EditorHeader>
            <strong>{editing ? "거래 수정" : "거래 추가"}</strong>
            <IconButton title="닫기" onClick={closeForm}>
              <X size={16} />
            </IconButton>
          </EditorHeader>

          <TwoColumns>
            <Field>
              유형
              <Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                <option value="expense">지출</option>
                <option value="income">수입</option>
                <option value="transfer">이체</option>
              </Select>
            </Field>
            <Field>
              상태
              <Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                <option value="confirmed">확정</option>
                <option value="pending">대기</option>
                <option value="excluded">제외</option>
              </Select>
            </Field>
          </TwoColumns>

          <Field>
            금액
            <Input
              inputMode="numeric"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </Field>

          <Field>
            거래일시
            <Input
              type="datetime-local"
              value={draft.transactionAt}
              onChange={(event) => setDraft({ ...draft, transactionAt: event.target.value })}
            />
          </Field>

          <Field>
            카테고리
            <Select
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
            >
              <option value="">기타 자동 적용</option>
              {store.currentCategories
                .filter((category) => category.type === draft.type)
                .map((category) => (
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
              onChange={(event) => setDraft({ ...draft, merchantName: event.target.value })}
            />
          </Field>

          <Field>
            메모
            <Textarea value={draft.memo} onChange={(event) => setDraft({ ...draft, memo: event.target.value })} />
          </Field>

          <Button $variant="primary" onClick={() => void save()}>
            <Save size={16} /> 저장
          </Button>
        </Editor>
      ) : null}

      <TransactionList>
        {store.selectedDateTransactions.map((transaction) => {
          const category = store.data.categories.find((item) => item.id === transaction.categoryId)
          return (
            <TransactionItem key={transaction.id}>
              <TransactionTime>{formatKoreanTime(transaction.transactionAt)}</TransactionTime>
              <TransactionBody>
                <TransactionName>{transaction.merchantName || transaction.memo || "거래"}</TransactionName>
                <TransactionMeta>
                  {category?.name ?? "기타"} · {transaction.status}
                </TransactionMeta>
              </TransactionBody>
              <Amount $type={transaction.type}>
                {transaction.type === "income" ? "+" : "-"}
                {formatKrw(transaction.amount)}
              </Amount>
              <ActionCluster>
                <IconButton title="수정" onClick={() => openEdit(transaction)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  $variant="danger"
                  title="삭제"
                  onClick={() => void store.softDeleteTransaction(transaction.id)}
                >
                  <Trash2 size={15} />
                </IconButton>
              </ActionCluster>
            </TransactionItem>
          )
        })}
      </TransactionList>

      {store.selectedDateTransactions.length === 0 ? (
        <Empty>
          <Check size={20} />
          <span>등록된 거래 없음</span>
        </Empty>
      ) : null}
    </SidePanel>
  )
})

const PanelTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`

const Subtle = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  margin-top: 4px;
`

const Editor = styled.div`
  display: grid;
  gap: 12px;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  padding: 14px;
  margin-bottom: 16px;
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

const TransactionList = styled.div`
  display: grid;
  gap: 8px;
`

const TransactionItem = styled.article`
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  padding: 10px;

  &:hover > div:last-of-type {
    opacity: 1;
  }
`

const TransactionTime = styled.div`
  color: ${colors.muted};
  font-family: var(--font-geist-mono);
  font-size: 12px;
`

const TransactionBody = styled.div`
  min-width: 0;
`

const TransactionName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 760;
`

const TransactionMeta = styled.div`
  margin-top: 2px;
  color: ${colors.muted};
  font-size: 12px;
`

const Amount = styled.div<{ $type: Transaction["type"] }>`
  color: ${({ $type }) => ($type === "income" ? colors.green : $type === "expense" ? colors.coral : colors.blue)};
  font-weight: 850;
  white-space: nowrap;
`

const ActionCluster = styled.div`
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  opacity: 0.88;
`

const Empty = styled.div`
  min-height: 120px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: ${colors.muted};
  border: 1px dashed ${colors.border};
  border-radius: 8px;
`
