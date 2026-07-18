import styled from "@emotion/styled"
import type { Category, PaymentMethod, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  CalendarRange,
  CreditCard,
  Landmark,
  Repeat2,
  Wallet,
} from "lucide-react"
import {
  getInstallmentLabel,
  getPaymentMetadataLabel,
} from "./transactionPresentation"

type PaymentChipKind = "credit" | "debit" | "bank" | "cash"

interface TransactionMetadataChipsProps {
  transaction: Transaction
  category?: Category
  paymentMethod?: PaymentMethod
}

export function TransactionMetadataChips({
  transaction,
  category,
  paymentMethod,
}: TransactionMetadataChipsProps) {
  const paymentLabel = getPaymentMetadataLabel(transaction, paymentMethod)
  const installmentLabel = getInstallmentLabel(transaction)
  const paymentKind: PaymentChipKind =
    paymentMethod?.type === "card"
      ? paymentMethod.isDebit
        ? "debit"
        : "credit"
      : paymentMethod?.type === "bank"
        ? "bank"
        : "cash"

  return (
    <Chips>
      {transaction.recurringType === "fixed" ? (
        <FixedChip>
          <Repeat2 size={13} /> 고정비
        </FixedChip>
      ) : null}
      <CategoryChip $color={category?.color ?? colors.subtle}>
        {category?.name ?? "기타"}
      </CategoryChip>
      {paymentLabel ? (
        <PaymentChip $kind={paymentKind} title={paymentLabel}>
          {paymentMethod?.type === "card" ? (
            <CreditCard size={13} aria-hidden="true" />
          ) : paymentMethod?.type === "bank" ? (
            <Landmark size={13} aria-hidden="true" />
          ) : (
            <Wallet size={13} aria-hidden="true" />
          )}
          {paymentLabel}
        </PaymentChip>
      ) : null}
      {installmentLabel ? (
        <InstallmentChip>
          <CalendarRange size={13} /> {installmentLabel}
        </InstallmentChip>
      ) : null}
    </Chips>
  )
}

const Chips = styled.div`
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`

const Chip = styled.span`
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: #fff;
  color: ${colors.ink};
  padding: 4px 7px 4px 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
`

const PaymentChip = styled(Chip)<{ $kind: PaymentChipKind }>`
  max-width: 100%;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: inset 3px 0 0
    ${({ $kind }) =>
      $kind === "debit"
        ? colors.teal
        : $kind === "bank"
          ? colors.green
          : $kind === "cash"
            ? colors.amber
            : colors.blue};

  svg {
    flex: 0 0 auto;
    color: ${({ $kind }) =>
      $kind === "debit"
        ? colors.teal
        : $kind === "bank"
          ? colors.green
          : $kind === "cash"
            ? colors.amber
            : colors.blue};
  }
`

const InstallmentChip = styled(Chip)`
  box-shadow: inset 3px 0 0 ${colors.violet};
`

const FixedChip = styled(Chip)`
  font-weight: 700;
  box-shadow: inset 3px 0 0 ${colors.teal};
`

const CategoryChip = styled(Chip)<{ $color: string }>`
  box-shadow: inset 3px 0 0 ${({ $color }) => $color};
`
