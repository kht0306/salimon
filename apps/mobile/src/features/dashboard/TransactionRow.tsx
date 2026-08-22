import styled from "@emotion/native"
import { formatKoreanTime, formatKrw, getCategoryLabel } from "@salimon/domain"
import type { Category, LedgerMember, Transaction } from "@salimon/types"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import {
  transactionMemberLabel,
  transactionStructureLabels,
} from "../transactions/transactionPresentation"
import { transactionTypeLabel } from "./dashboardPresentation"

interface TransactionRowProps {
  categories: Category[]
  members: LedgerMember[]
  splitCount: number
  transaction: Transaction
  onPress: () => void
}

export function TransactionRow({
  categories,
  members,
  splitCount,
  transaction,
  onPress,
}: TransactionRowProps) {
  const categoryLabel = getCategoryLabel(
    categories,
    transaction.categoryId,
    "미분류",
  )
  const category = categories.find((item) => item.id === transaction.categoryId)
  const title = transaction.merchantName ?? transaction.memo ?? categoryLabel
  const typeLabel = transactionTypeLabel(transaction.type)
  const amountPrefix = transaction.type === "income" ? "+" : "−"
  const actor = transactionMemberLabel(transaction.actorUserId, members, "공통")
  const registrant = transactionMemberLabel(
    transaction.createdBy,
    members,
    "탈퇴한 멤버 또는 알 수 없음",
  )
  const structureLabels = transactionStructureLabels(transaction, splitCount)

  return (
    <Row
      accessible
      accessibilityLabel={`${formatKoreanTime(
        transaction.transactionAt,
      )}, ${title}, ${categoryLabel}, ${typeLabel} ${formatKrw(
        transaction.amount,
      )}, 거래자 ${actor}, 등록자 ${registrant}${
        structureLabels.length > 0 ? `, ${structureLabels.join(", ")}` : ""
      }${transaction.status === "excluded" ? ", 합계 제외" : ""}`}
      accessibilityRole="button"
      onPress={onPress}
    >
      <TransactionCopy>
        <Title>{title}</Title>
        <MetadataRow>
          <CategoryChip
            style={{
              borderLeftColor: category?.color ?? mobileTheme.colors.subtle,
            }}
          >
            <CategoryLabel>{categoryLabel}</CategoryLabel>
          </CategoryChip>
          <Metadata>
            {formatKoreanTime(transaction.transactionAt)}
            {transaction.status === "excluded" ? " · 합계 제외" : ""}
          </Metadata>
        </MetadataRow>
        <AuditInfo numberOfLines={1}>
          거래 {actor} · 등록 {registrant}
        </AuditInfo>
        {structureLabels.length > 0 ? (
          <BadgeRow>
            {structureLabels.map((label) => (
              <StructureBadge key={label}>{label}</StructureBadge>
            ))}
          </BadgeRow>
        ) : null}
      </TransactionCopy>
      <Amount $type={transaction.type}>
        {amountPrefix}
        {formatKrw(transaction.amount)}
      </Amount>
    </Row>
  )
}

const Row = styled.Pressable({
  minHeight: 78,
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

const MetadataRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  gap: mobileTheme.spacing[1],
  marginTop: mobileTheme.spacing[1],
})

const CategoryChip = styled.View({
  borderWidth: 1,
  borderLeftWidth: 3,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  paddingVertical: 3,
  paddingHorizontal: 6,
})

const CategoryLabel = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
`

const Metadata = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
`

const AuditInfo = styled(AppText)`
  margin-top: ${mobileTheme.spacing[1]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
`

const BadgeRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[1],
  marginTop: mobileTheme.spacing[1],
})

const StructureBadge = styled(AppText)`
  align-self: flex-start;
  border-radius: ${mobileTheme.radii.round}px;
  background-color: ${mobileTheme.colors.tealSoft};
  color: ${mobileTheme.colors.teal};
  padding: 2px ${mobileTheme.spacing[2]}px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
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
