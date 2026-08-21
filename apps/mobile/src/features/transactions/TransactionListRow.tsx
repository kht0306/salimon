import styled from "@emotion/native"
import { formatKoreanTime, formatKrw } from "@salimon/domain"
import type { Category, LedgerMember, Transaction } from "@salimon/types"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import {
  transactionCategoryLabel,
  transactionMemberLabel,
  transactionStructureLabels,
  transactionTypeLabel,
} from "./transactionPresentation"

interface TransactionListRowProps {
  categories: Category[]
  members: LedgerMember[]
  onPress: () => void
  splitCount: number
  transaction: Transaction
}

export function TransactionListRow({
  categories,
  members,
  onPress,
  splitCount,
  transaction,
}: TransactionListRowProps) {
  const title =
    transaction.merchantName ??
    transaction.memo ??
    transactionCategoryLabel(transaction, categories)
  const actor = transactionMemberLabel(transaction.actorUserId, members, "공통")
  const structureLabels = transactionStructureLabels(transaction, splitCount)
  const typeLabel = transactionTypeLabel(transaction.type)
  const amountPrefix = transaction.type === "income" ? "+" : "−"

  return (
    <Row
      $excluded={transaction.status === "excluded"}
      accessibilityLabel={`${title}, ${typeLabel} ${formatKrw(
        transaction.amount,
      )}, 거래 상세 열기`}
      accessibilityRole="button"
      onPress={onPress}
    >
      <TypeMark $type={transaction.type}>
        <TypeInitial $type={transaction.type}>
          {typeLabel.slice(0, 1)}
        </TypeInitial>
      </TypeMark>
      <MainCopy>
        <Title numberOfLines={1}>{title}</Title>
        <Metadata numberOfLines={1}>
          {formatKoreanTime(transaction.transactionAt)} · {actor} ·{" "}
          {transactionCategoryLabel(transaction, categories)}
        </Metadata>
        {structureLabels.length > 0 || transaction.status === "excluded" ? (
          <BadgeRow>
            {structureLabels.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
            {transaction.status === "excluded" ? (
              <WarningBadge>합계 제외</WarningBadge>
            ) : null}
          </BadgeRow>
        ) : null}
      </MainCopy>
      <Amount $type={transaction.type}>
        {amountPrefix}
        {formatKrw(transaction.amount)}
      </Amount>
    </Row>
  )
}

const Row = styled.Pressable<{ $excluded: boolean }>(({ $excluded }) => ({
  minHeight: 72,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
  opacity: $excluded ? 0.62 : 1,
}))

const TypeMark = styled.View<{ $type: Transaction["type"] }>(({ $type }) => ({
  width: 36,
  height: 36,
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.round,
  backgroundColor:
    $type === "income"
      ? mobileTheme.colors.greenSoft
      : $type === "expense"
        ? mobileTheme.colors.panelSubtle
        : mobileTheme.colors.tealSoft,
}))

const TypeInitial = styled(AppText)<{ $type: Transaction["type"] }>(
  ({ $type }) => ({
    color:
      $type === "income"
        ? mobileTheme.colors.green
        : $type === "expense"
          ? mobileTheme.colors.muted
          : mobileTheme.colors.teal,
    fontSize: 12,
    fontWeight: "600",
  }),
)

const MainCopy = styled.View({
  minWidth: 0,
  flex: 1,
  gap: mobileTheme.spacing[1],
})

const Title = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 13,
  fontWeight: "600",
  lineHeight: 19,
})

const Metadata = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
})

const BadgeRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[1],
})

const Badge = styled(AppText)({
  alignSelf: "flex-start",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.panelSubtle,
  color: mobileTheme.colors.muted,
  fontSize: 9,
  fontWeight: "700",
  paddingVertical: 2,
  paddingHorizontal: mobileTheme.spacing[2],
})

const WarningBadge = styled(Badge)({
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
})

const Amount = styled(AppText)<{ $type: Transaction["type"] }>(({ $type }) => ({
  maxWidth: "38%",
  color: $type === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
  lineHeight: 19,
  textAlign: "right",
}))
