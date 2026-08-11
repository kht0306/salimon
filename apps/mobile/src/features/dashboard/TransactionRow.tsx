import styled from "@emotion/native"
import { formatKoreanTime, formatKrw, getCategoryLabel } from "@salimon/domain"
import type { Category, Transaction } from "@salimon/types"
import { mobileTheme } from "../../theme"
import { transactionTypeLabel } from "./dashboardPresentation"

interface TransactionRowProps {
  categories: Category[]
  transaction: Transaction
}

export function TransactionRow({
  categories,
  transaction,
}: TransactionRowProps) {
  const categoryLabel = getCategoryLabel(
    categories,
    transaction.categoryId,
    "미분류",
  )
  const title = transaction.merchantName ?? transaction.memo ?? categoryLabel
  const typeLabel = transactionTypeLabel(transaction.type)
  const amountPrefix = transaction.type === "income" ? "+" : "−"

  return (
    <Row
      accessible
      accessibilityLabel={`${formatKoreanTime(
        transaction.transactionAt,
      )}, ${title}, ${typeLabel} ${formatKrw(transaction.amount)}${
        transaction.status === "excluded" ? ", 합계 제외" : ""
      }`}
    >
      <Time>{formatKoreanTime(transaction.transactionAt)}</Time>
      <TransactionCopy>
        <Title>{title}</Title>
        <Metadata>
          {typeLabel} · {categoryLabel}
          {transaction.status === "excluded" ? " · 합계 제외" : ""}
        </Metadata>
      </TransactionCopy>
      <Amount $type={transaction.type}>
        {amountPrefix}
        {formatKrw(transaction.amount)}
      </Amount>
    </Row>
  )
}

const Row = styled.View`
  min-height: 72px;
  flex-direction: row;
  align-items: flex-start;
  gap: ${mobileTheme.spacing[3]}px;
  margin: 0 ${mobileTheme.spacing[5]}px;
  border-bottom-width: 1px;
  border-bottom-color: ${mobileTheme.colors.border};
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[3]}px ${mobileTheme.spacing[4]}px;
`

const Time = styled.Text`
  width: 58px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 16px;
`

const TransactionCopy = styled.View`
  min-width: 0;
  flex: 1;
`

const Title = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
`

const Metadata = styled.Text`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
`

const Amount = styled.Text<{ $type: Transaction["type"] }>`
  max-width: 42%;
  color: ${({ $type }) =>
    $type === "income"
      ? mobileTheme.colors.green
      : $type === "expense"
        ? mobileTheme.colors.coral
        : mobileTheme.colors.teal};
  font-size: 13px;
  font-weight: 800;
  line-height: 20px;
  text-align: right;
`
