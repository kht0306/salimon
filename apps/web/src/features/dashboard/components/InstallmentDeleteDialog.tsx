"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { InstallmentDeleteScope, Transaction } from "@salimon/types"
import { colors, radii, shadows } from "@salimon/ui-tokens"
import { Button } from "../styles"

interface InstallmentDeleteDialogProps {
  transaction: Transaction
  seriesTransactions: Transaction[]
  busy: boolean
  onClose: () => void
  onSelect: (scope: InstallmentDeleteScope) => void
}

interface DeleteOption {
  scope: InstallmentDeleteScope
  label: string
  description: string
  disabled?: boolean
  danger?: boolean
}

export function InstallmentDeleteDialog({
  transaction,
  seriesTransactions,
  busy,
  onClose,
  onSelect,
}: InstallmentDeleteDialogProps) {
  const installmentNumber = transaction.installmentNumber ?? 1
  const installmentTotal = transaction.installmentTotal ?? installmentNumber
  const activeTransactions = seriesTransactions.filter(
    (item) => !item.deletedAt,
  )
  const futureTransactions = activeTransactions.filter(
    (item) => (item.installmentNumber ?? 0) > installmentNumber,
  )
  const currentAndFutureTransactions = activeTransactions.filter(
    (item) => (item.installmentNumber ?? 0) >= installmentNumber,
  )
  const options: DeleteOption[] = [
    {
      scope: "single",
      label: "이 회차만 삭제",
      description: `${installmentNumber}/${installmentTotal}회차 ${formatKrw(transaction.amount)}만 삭제하고 이후 할부는 유지합니다.`,
    },
    {
      scope: "future",
      label: "다음 회차부터 종료",
      description:
        futureTransactions.length > 0
          ? `현재 회차는 유지하고 다음 ${futureTransactions.length}건, ${formatKrw(sumTransactions(futureTransactions))}을 제거합니다.`
          : "현재 회차가 마지막 회차입니다.",
      disabled: futureTransactions.length === 0,
    },
    {
      scope: "current_and_future",
      label: "이 회차부터 종료",
      description: `${currentAndFutureTransactions.length}건, ${formatKrw(sumTransactions(currentAndFutureTransactions))}을 제거하고 이전 회차는 유지합니다.`,
      danger: true,
    },
    {
      scope: "all",
      label: "할부 전체 삭제",
      description: `활성 할부 ${activeTransactions.length}건, ${formatKrw(sumTransactions(activeTransactions))}을 모두 제거합니다.`,
      danger: true,
    },
  ]

  return (
    <DialogBackdrop
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <DialogCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="installment-delete-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose()
        }}
      >
        <DialogHeader>
          <strong id="installment-delete-title">할부 삭제 범위 선택</strong>
          <span>
            {transaction.merchantName ?? "할부 거래"} · {installmentNumber}/
            {installmentTotal}회차
          </span>
        </DialogHeader>

        <OptionList>
          {options.map((option) => (
            <OptionButton
              key={option.scope}
              type="button"
              $danger={option.danger}
              disabled={busy || option.disabled}
              onClick={() => onSelect(option.scope)}
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </OptionButton>
          ))}
        </OptionList>

        <DialogActions>
          <Button type="button" autoFocus disabled={busy} onClick={onClose}>
            취소
          </Button>
        </DialogActions>
      </DialogCard>
    </DialogBackdrop>
  )
}

function sumTransactions(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
}

const DialogBackdrop = styled.div`
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 42%);
  padding: 20px;
`

const DialogCard = styled.div`
  width: min(460px, 100%);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: ${shadows.panel};
  padding: 18px;
`

const DialogHeader = styled.header`
  display: grid;
  gap: 5px;

  strong {
    color: ${colors.ink};
    font-size: 15px;
  }

  span {
    color: ${colors.muted};
    font-size: 12px;
  }
`

const OptionList = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 16px;
`

const OptionButton = styled.button<{ $danger?: boolean }>`
  display: grid;
  gap: 4px;
  width: 100%;
  border: 1px solid ${({ $danger }) => ($danger ? colors.coral : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $danger }) =>
    $danger ? colors.coralSoft : colors.panelSubtle};
  color: ${({ $danger }) => ($danger ? colors.coral : colors.ink)};
  padding: 11px 12px;
  text-align: left;
  cursor: pointer;

  strong {
    font-size: 12px;
  }

  small {
    color: ${colors.muted};
    font-size: 10px;
    line-height: 1.45;
  }

  &:hover:not(:disabled) {
    border-color: ${colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const DialogActions = styled.footer`
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
`
