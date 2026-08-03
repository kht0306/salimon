"use client"

import styled from "@emotion/styled"
import type { Transaction } from "@salimon/types"
import { colors } from "@salimon/ui-tokens"
import { Check, ChevronDown } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { TransactionHistoryItem } from "./TransactionHistoryItem"
import {
  groupTransactionsByActor,
  groupTransactionsByRecurrence,
  groupTransactionsByRegistrant,
} from "./transactionPresentation"

interface TransactionHistoryListProps {
  isDeletingInstallment: boolean
  onCopy: (transaction: Transaction) => void
  onEdit: (transaction: Transaction) => void
  onEndInstallment: (transaction: Transaction) => void
  onOpenInstallmentDelete: (transaction: Transaction) => void
}

export const TransactionHistoryList = observer(function TransactionHistoryList({
  isDeletingInstallment,
  onCopy,
  onEdit,
  onEndInstallment,
  onOpenInstallmentDelete,
}: TransactionHistoryListProps) {
  const store = useAppStore()
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

  return (
    <>
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
                    {group.transactions.map((transaction) => (
                      <TransactionHistoryItem
                        key={transaction.id}
                        transaction={transaction}
                        isDeletingInstallment={isDeletingInstallment}
                        onCopy={onCopy}
                        onEdit={onEdit}
                        onEndInstallment={onEndInstallment}
                        onOpenInstallmentDelete={onOpenInstallmentDelete}
                      />
                    ))}
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
    </>
  )
})

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
