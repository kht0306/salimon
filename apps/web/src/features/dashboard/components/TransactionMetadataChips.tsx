import styled from "@emotion/styled"
import type { Category, PaymentMethod, Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  CalendarRange,
  CreditCard,
  Landmark,
  Repeat2,
  Wallet,
  WalletCards,
} from "lucide-react"
import {
  getInstallmentLabel,
  getPaymentLabel,
  getPaymentMethodTypeLabel,
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
  const paymentLabel = getPaymentLabel(transaction, paymentMethod)
  const installmentLabel = getInstallmentLabel(transaction)
  const paymentKind: PaymentChipKind =
    paymentMethod?.type === "card"
      ? paymentMethod.isDebit
        ? "debit"
        : "credit"
      : paymentMethod?.type === "bank"
        ? "bank"
        : "cash"
  const paymentTypeLabel = paymentMethod
    ? getPaymentMethodTypeLabel(paymentMethod)
    : "현금"

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
        <PaymentChip title={`${paymentTypeLabel} · ${paymentLabel}`}>
          <PaymentTypeBadge $kind={paymentKind}>
            {paymentTypeLabel}
          </PaymentTypeBadge>
          <PaymentDetails $kind={paymentKind}>
            {paymentKind === "credit" ? (
              <CreditCard size={13} aria-hidden="true" />
            ) : paymentKind === "debit" ? (
              <WalletCards size={13} aria-hidden="true" />
            ) : paymentMethod?.type === "bank" ? (
              <Landmark size={13} aria-hidden="true" />
            ) : (
              <Wallet size={13} aria-hidden="true" />
            )}
            <span>{paymentLabel}</span>
          </PaymentDetails>
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

const PaymentChip = styled.span`
  min-width: 0;
  max-width: 100%;
  display: inline-flex;
  align-items: stretch;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: #fff;
  color: ${colors.ink};
  font-weight: 650;
  line-height: 1.2;
  overflow: hidden;
  white-space: nowrap;
`

const PaymentTypeBadge = styled.span<{ $kind: PaymentChipKind }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  background: ${({ $kind }) =>
    $kind === "debit"
      ? colors.teal
      : $kind === "bank"
        ? colors.green
        : $kind === "cash"
          ? colors.amber
          : colors.blue};
  color: ${({ $kind }) => ($kind === "cash" ? colors.ink : "#fff")};
  padding: 4px 6px;
  font-size: 9px;
  font-weight: 750;
`

const PaymentDetails = styled.span<{ $kind: PaymentChipKind }>`
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px 4px 6px;
  font-size: 10px;

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

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
