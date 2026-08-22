import styled from "@emotion/native"
import { formatKoreanTime, formatKrw, getCategoryLabel } from "@salimon/domain"
import type { Category, Transaction } from "@salimon/types"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import { transactionTypeLabel } from "./dashboardPresentation"

interface TransactionRowProps {
  categories: Category[]
  transaction: Transaction
  onPress: () => void
}

export function TransactionRow({
  categories,
  transaction,
  onPress,
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
      accessibilityRole="button"
      onPress={onPress}
    >
      <TransactionCopy>
        <Title>{title}</Title>
        <Metadata>
          {categoryLabel} · {formatKoreanTime(transaction.transactionAt)}
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

const Row = styled.Pressable({
  minHeight: 60,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  marginHorizontal: mobileTheme.spacing[4],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingVertical: mobileTheme.spacing[3],
})

const TransactionCopy = styled.View`
  min-width: 0;
  flex: 1;
`

const Title = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
`

const Metadata = styled(AppText)`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
`

const Amount = styled(AppText)<{ $type: Transaction["type"] }>`
  max-width: 40%;
  color: ${({ $type }) =>
    $type === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  text-align: right;
`
