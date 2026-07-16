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
import { getInstallmentLabel, getPaymentLabel } from "./transactionPresentation"

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
        <PaymentChip title={paymentLabel}>
          {paymentMethod?.type === "card" ? (
            <CreditCard size={13} />
          ) : paymentMethod?.type === "bank" ? (
            <Landmark size={13} />
          ) : (
            <Wallet size={13} />
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

const PaymentChip = styled(Chip)`
  max-width: 100%;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: inset 3px 0 0 ${colors.blue};
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
