"use client"

import styled from "@emotion/styled"
import {
  formatKoreanDate,
  formatKoreanTime,
  formatMoneyInput,
  formatKrw,
  getDateTimeLocalValue,
} from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  IconButton,
  Input,
  PanelTitle,
  Select,
  SidePanel,
  Textarea,
} from "../styles"

const statusLabels: Record<Transaction["status"], string> = {
  pending: "대기",
  confirmed: "확정",
  excluded: "제외",
}

const typeLabels: Record<Transaction["type"], string> = {
  expense: "지출",
  income: "수입",
  transfer: "이체",
}

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
      actorUserId: store.authUser?.id ?? "",
      recurringType: "none",
      installmentMonths: "2",
      transactionAt: `${selectedDate}T12:00`,
    }),
    [selectedDate, store.expenseCategories, store.authUser?.id],
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
      actorUserId: transaction.actorUserId ?? "",
      recurringType: "none",
      installmentMonths: "2",
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
    if (!Number.isSafeInteger(amount) || amount <= 0) {
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
      actorUserId: draft.actorUserId || undefined,
      recurringType:
        editing || draft.recurringType === "none"
          ? undefined
          : (draft.recurringType as "fixed" | "installment"),
      installmentMonths:
        draft.recurringType === "installment"
          ? Number(draft.installmentMonths)
          : undefined,
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
        <IconButton
          $variant="primary"
          title="거래 추가"
          onClick={openNew}
          disabled={!store.authUser || !store.selectedLedgerId}
        >
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
              <Select
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value })
                }
              >
                <option value="expense">지출</option>
                <option value="income">수입</option>
                <option value="transfer">이체</option>
              </Select>
            </Field>
            <Field>
              상태
              <Select
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value })
                }
              >
                <option value="confirmed">확정</option>
                <option value="pending">대기</option>
                <option value="excluded">제외</option>
              </Select>
            </Field>
          </TwoColumns>

          {!editing ? (
            <TwoColumns>
              <Field>
                반복 유형
                <Select
                  value={draft.recurringType}
                  onChange={(event) =>
                    setDraft({ ...draft, recurringType: event.target.value })
                  }
                >
                  <option value="none">일반 거래</option>
                  <option value="fixed">고정비</option>
                  <option value="installment">카드 할부</option>
                </Select>
              </Field>
              {draft.recurringType === "installment" ? (
                <Field>
                  전체 할부 개월
                  <Input
                    type="number"
                    min="2"
                    max="120"
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
          ) : null}

          <Field>
            금액
            {draft.recurringType === "installment" ? " (월별 할부액)" : ""}
            <Input
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
          </Field>

          <Field>
            거래일시
            <Input
              type="datetime-local"
              value={draft.transactionAt}
              onChange={(event) =>
                setDraft({ ...draft, transactionAt: event.target.value })
              }
            />
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
            카테고리
            <Select
              value={draft.categoryId}
              onChange={(event) =>
                setDraft({ ...draft, categoryId: event.target.value })
              }
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

          <Button $variant="primary" onClick={() => void save()}>
            <Save size={16} /> 저장
          </Button>
        </Editor>
      ) : null}

      <TransactionList>
        {store.selectedDateTransactions.map((transaction) => {
          const category = store.data.categories.find(
            (item) => item.id === transaction.categoryId,
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
            <TransactionItem key={transaction.id}>
              <TransactionWhen>
                <TransactionTime>
                  {formatKoreanTime(transaction.transactionAt)}
                </TransactionTime>
                <ActorName>
                  <strong>행위자</strong> {actor}
                </ActorName>
              </TransactionWhen>
              <TransactionBody>
                <TransactionName>
                  {transaction.merchantName || transaction.memo || "거래"}
                </TransactionName>
                <TransactionMeta>
                  {typeLabels[transaction.type]} · {category?.name ?? "기타"} ·{" "}
                  {statusLabels[transaction.status]}
                  {transaction.recurringType === "fixed" ? " · 고정비" : ""}
                  {transaction.recurringType === "installment"
                    ? ` · ${transaction.installmentNumber}/${transaction.installmentTotal}회`
                    : ""}
                </TransactionMeta>
                <RegisteredAt>
                  등록{" "}
                  {new Date(transaction.createdAt).toLocaleString("ko-KR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </RegisteredAt>
              </TransactionBody>
              <TransactionEnd>
                <Amount $type={transaction.type}>
                  {transaction.type === "income"
                    ? "+"
                    : transaction.type === "expense"
                      ? "-"
                      : ""}
                  {formatKrw(transaction.amount)}
                </Amount>
                <RegistrantName>등록자: {registrant}</RegistrantName>
                <ActionCluster>
                  <CompactAction
                    title="수정"
                    onClick={() => openEdit(transaction)}
                  >
                    <Pencil size={14} />
                  </CompactAction>
                  <CompactAction
                    $variant="danger"
                    title="삭제"
                    onClick={() =>
                      void store.softDeleteTransaction(transaction.id)
                    }
                  >
                    <Trash2 size={14} />
                  </CompactAction>
                </ActionCluster>
              </TransactionEnd>
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

      <DailySummary>
        <SummaryRow>
          <span>지출 합계</span>
          <SummaryAmount $tone="expense">
            -
            {formatKrw(
              store.selectedDateTransactions
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
              store.selectedDateTransactions
                .filter(
                  (item) =>
                    item.type === "income" && item.status !== "excluded",
                )
                .reduce((sum, item) => sum + item.amount, 0),
            )}
          </SummaryAmount>
        </SummaryRow>
        <SettlementRow>
          <span>정산 합계</span>
          <strong>
            {formatKrw(
              store.selectedDateTransactions
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

const Editor = styled.div`
  display: grid;
  gap: 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panelSubtle};
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
`

const TransactionItem = styled.article`
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  border-bottom: 1px solid ${colors.border};
  padding: 12px 0;

  &:hover > div:last-of-type > div:last-of-type,
  &:focus-within > div:last-of-type > div:last-of-type {
    opacity: 1;
  }
`

const TransactionTime = styled.div`
  color: ${colors.muted};
  font-family: var(--font-geist-mono);
  font-size: 12px;
  line-height: 20px;
`

const TransactionWhen = styled.div`
  min-width: 0;
`

const ActorName = styled.div`
  margin-top: 5px;
  color: ${colors.ink};
  font-size: 10px;
  overflow-wrap: anywhere;

  strong {
    display: block;
    color: ${colors.teal};
    font-weight: 700;
  }
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

const TransactionMeta = styled.div`
  margin-top: 2px;
  color: ${colors.muted};
  font-size: 12px;
`

const RegisteredAt = styled.div`
  margin-top: 2px;
  color: ${colors.subtle};
  font-size: 10px;
`

const RegistrantName = styled.div`
  max-width: 94px;
  color: ${colors.muted};
  font-size: 10px;
  text-align: right;
  overflow-wrap: anywhere;
`

const Amount = styled.div<{ $type: Transaction["type"] }>`
  color: ${({ $type }) =>
    $type === "income"
      ? colors.green
      : $type === "expense"
        ? colors.coral
        : colors.blue};
  font-family: var(--font-geist-mono);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
`

const TransactionEnd = styled.div`
  display: grid;
  justify-items: end;
  gap: 7px;
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

const SummaryAmount = styled.strong<{ $tone: "expense" | "income" }>`
  color: ${({ $tone }) => ($tone === "expense" ? colors.coral : colors.green)};
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
