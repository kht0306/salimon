import styled from "@emotion/native"
import { formatKoreanTime, formatKrw, getCategoryLabel } from "@salimon/domain"
import type {
  Category,
  Ledger,
  LedgerMember,
  Transaction,
} from "@salimon/types"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import {
  getSettlementRoleAccess,
  settlementMemberName,
  type MobileSettlementSummary,
  type SettlementRoleAccess,
  type VisiblePaymentMethodSummary,
} from "./settlementPresentation"

interface SettlementBreakdownProps {
  categories: Category[]
  ledgerType: Ledger["type"]
  members: LedgerMember[]
  monthNote?: string
  paymentMethodSummary: VisiblePaymentMethodSummary
  roleAccess: SettlementRoleAccess
  summary: MobileSettlementSummary
  onTransactionPress: (transactionId: string) => void
}

export function SettlementBreakdown({
  categories,
  ledgerType,
  members,
  monthNote,
  paymentMethodSummary,
  roleAccess,
  summary,
  onTransactionPress,
}: SettlementBreakdownProps) {
  const maxMemberExpense = Math.max(
    1,
    ...summary.memberRows.map((row) => row.actorExpense),
    ...summary.unassignedRows.map((row) => row.amount),
  )
  const maxCategorySpent = Math.max(
    1,
    ...summary.categoryRows.map((row) => row.spent),
  )
  const maxWeekExpense = Math.max(
    1,
    ...summary.weekRows.map((row) => row.amount),
  )

  return (
    <>
      <SectionCard>
        <SectionHeading>
          <SectionHeadingCopy>
            <SectionTitle>
              {ledgerType === "shared" ? "공동 가계부 멤버" : "가계부 구성원"}
            </SectionTitle>
            <SectionDescription>
              거래자 기준 지출과 실제 등록자를 구분해서 표시합니다.
            </SectionDescription>
          </SectionHeadingCopy>
          <SectionCount>{members.length}명</SectionCount>
        </SectionHeading>

        <MemberList>
          {summary.memberRows.map((row) => {
            const access = getSettlementRoleAccess(row.member.role)
            return (
              <MemberRow key={row.member.id}>
                <MemberHeading>
                  <MemberIdentity>
                    <MemberAvatar>
                      <MemberInitial>
                        {row.member.nickname.slice(0, 1)}
                      </MemberInitial>
                    </MemberAvatar>
                    <MemberCopy>
                      <MemberName>{row.member.nickname}</MemberName>
                      <MemberMeta>
                        {access.label} · 거래자 {row.actorTransactionCount}건 ·
                        등록자 {row.registeredTransactionCount}건
                      </MemberMeta>
                    </MemberCopy>
                  </MemberIdentity>
                  <MemberAmount>{formatKrw(row.actorExpense)}</MemberAmount>
                </MemberHeading>
                <ProgressTrack>
                  <ProgressFill
                    style={{
                      width: `${(row.actorExpense / maxMemberExpense) * 100}%`,
                    }}
                  />
                </ProgressTrack>
              </MemberRow>
            )
          })}

          {summary.unassignedRows.map((row) => (
            <MemberRow key={row.label}>
              <MemberHeading>
                <MemberCopy>
                  <MemberName>{row.label}</MemberName>
                  <MemberMeta>거래자 {row.transactionCount}건</MemberMeta>
                </MemberCopy>
                <MemberAmount>{formatKrw(row.amount)}</MemberAmount>
              </MemberHeading>
              <ProgressTrack>
                <ProgressFill
                  style={{ width: `${(row.amount / maxMemberExpense) * 100}%` }}
                />
              </ProgressTrack>
            </MemberRow>
          ))}
        </MemberList>

        <Explanation>
          멤버별 금액은 거래에 지정된 ‘거래자’ 기준이며 실제 송금액이나 1/N
          분담액을 의미하지 않습니다.
        </Explanation>

        <PrivacyNotice>
          <PrivacyTitle>결제수단 공개 범위 보호</PrivacyTitle>
          <PrivacyDescription>
            공동 공개 {paymentMethodSummary.ledgerVisibleCount}개 · 내 비공개
            결제수단 {paymentMethodSummary.privateOwnedCount}개만 현재 세션에서
            확인할 수 있습니다. 다른 멤버의 비공개 이름·카드번호는 표시하지
            않습니다.
          </PrivacyDescription>
        </PrivacyNotice>
      </SectionCard>

      <SectionCard>
        <SectionHeading>
          <SectionHeadingCopy>
            <SectionTitle>카테고리별 지출</SectionTitle>
            <SectionDescription>
              하위 분류와 분할 거래 금액을 대분류에 합산했습니다.
            </SectionDescription>
          </SectionHeadingCopy>
          <SectionCount>{summary.categoryRows.length}개</SectionCount>
        </SectionHeading>

        {summary.categoryRows.length > 0 ? (
          <BreakdownList>
            {summary.categoryRows.map((row) => {
              const comparisonBase = row.budget || maxCategorySpent
              const overBudget = row.budget > 0 && row.spent > row.budget
              return (
                <BreakdownRow key={row.category.id}>
                  <BreakdownHeading>
                    <BreakdownNameRow>
                      <CategoryMarker
                        style={{ backgroundColor: row.category.color }}
                      />
                      <BreakdownName numberOfLines={2}>
                        {getCategoryLabel(categories, row.category.id)}
                      </BreakdownName>
                    </BreakdownNameRow>
                    <BreakdownValue $warning={overBudget}>
                      {formatKrw(row.spent)}
                      {row.budget > 0 ? ` / ${formatKrw(row.budget)}` : ""}
                    </BreakdownValue>
                  </BreakdownHeading>
                  <BreakdownTrack>
                    <CategoryFill
                      style={{
                        backgroundColor: overBudget
                          ? mobileTheme.colors.amber
                          : row.category.color,
                        width: `${Math.min(
                          100,
                          (row.spent / comparisonBase) * 100,
                        )}%`,
                      }}
                    />
                  </BreakdownTrack>
                  {overBudget ? (
                    <WarningLabel>
                      예산보다 {formatKrw(row.spent - row.budget)} 초과
                    </WarningLabel>
                  ) : null}
                </BreakdownRow>
              )
            })}
          </BreakdownList>
        ) : (
          <EmptyText>확정 지출 또는 설정된 예산이 없습니다.</EmptyText>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeading>
          <SectionHeadingCopy>
            <SectionTitle>주차별 공동생활비</SectionTitle>
            <SectionDescription>
              매월 1일부터 7일 단위로 확정 지출을 묶었습니다.
            </SectionDescription>
          </SectionHeadingCopy>
        </SectionHeading>

        <BreakdownList>
          {summary.weekRows.map((week) => (
            <BreakdownRow key={week.label}>
              <BreakdownHeading>
                <BreakdownName>
                  {week.label} · {week.startDay}–{week.endDay}일
                </BreakdownName>
                <BreakdownValue $warning={false}>
                  {formatKrw(week.amount)} · {week.count}건
                </BreakdownValue>
              </BreakdownHeading>
              <BreakdownTrack>
                <WeekFill
                  style={{
                    width: `${(week.amount / maxWeekExpense) * 100}%`,
                  }}
                />
              </BreakdownTrack>
            </BreakdownRow>
          ))}
        </BreakdownList>
      </SectionCard>

      <SectionCard>
        <SectionHeading>
          <SectionHeadingCopy>
            <SectionTitle>공동 월 정산 메모</SectionTitle>
            <SectionDescription>
              이월·환급·가족 합의 등 거래 밖의 정산 내용을 확인합니다.
            </SectionDescription>
          </SectionHeadingCopy>
          <ReadOnlyLabel>
            {roleAccess.canEditMonthNote ? "모바일 읽기 전용" : "조회 권한"}
          </ReadOnlyLabel>
        </SectionHeading>
        <MonthNote $empty={!monthNote?.trim()}>
          {monthNote?.trim() || "이 달에 작성된 정산 메모가 없습니다."}
        </MonthNote>
      </SectionCard>

      <SectionCard>
        <SectionHeading>
          <SectionHeadingCopy>
            <SectionTitle>최근 정산 기록</SectionTitle>
            <SectionDescription>
              거래자는 사용 주체, 등록자는 앱에 기록한 사람입니다.
            </SectionDescription>
          </SectionHeadingCopy>
          <SectionCount>
            {summary.confirmedCount + summary.excludedCount}건
          </SectionCount>
        </SectionHeading>

        {summary.recentTransactions.length > 0 ? (
          <RecentList>
            {summary.recentTransactions.map((transaction) => (
              <RecentTransaction
                key={transaction.id}
                accessibilityRole="button"
                onPress={() => onTransactionPress(transaction.id)}
              >
                <RecentCopy>
                  <RecentTopLine>
                    <RecentTitle numberOfLines={1}>
                      {transaction.merchantName ||
                        transaction.memo ||
                        getCategoryLabel(
                          categories,
                          transaction.categoryId,
                          "거래",
                        )}
                    </RecentTitle>
                    <RecentAmount $type={transaction.type}>
                      {transaction.type === "income" ? "+" : "−"}
                      {formatKrw(transaction.amount)}
                    </RecentAmount>
                  </RecentTopLine>
                  <RecentMeta numberOfLines={2}>
                    거래자{" "}
                    {settlementMemberName(
                      members,
                      transaction.actorUserId,
                      "공통",
                    )}{" "}
                    · 등록자{" "}
                    {settlementMemberName(
                      members,
                      transaction.createdBy,
                      "알 수 없음",
                    )}
                  </RecentMeta>
                  <RecentMeta>
                    {formatTransactionDay(transaction.transactionAt)} ·
                    {formatKoreanTime(transaction.transactionAt)}
                    {transaction.status === "excluded" ? " · 정산 제외" : ""}
                  </RecentMeta>
                </RecentCopy>
              </RecentTransaction>
            ))}
          </RecentList>
        ) : (
          <EmptyText>이 달에 기록된 거래가 없습니다.</EmptyText>
        )}
      </SectionCard>
    </>
  )
}

function formatTransactionDay(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(new Date(value))
}

const SectionCard = styled.View({
  gap: mobileTheme.spacing[4],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const SectionHeading = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const SectionHeadingCopy = styled.View({ minWidth: 0, flex: 1, gap: 3 })

const SectionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "600",
})

const SectionDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
})

const SectionCount = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "700",
})

const MemberList = styled.View({ gap: mobileTheme.spacing[4] })

const MemberRow = styled.View({ gap: mobileTheme.spacing[2] })

const MemberHeading = styled.View({
  minHeight: 34,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const MemberIdentity = styled.View({
  minWidth: 0,
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const MemberAvatar = styled.View({
  width: 32,
  height: 32,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.tealSoft,
})

const MemberInitial = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 12,
  fontWeight: "600",
})

const MemberCopy = styled.View({ minWidth: 0, flex: 1, gap: 2 })

const MemberName = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
})

const MemberMeta = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})

const MemberAmount = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
})

const ProgressTrack = styled.View({
  height: 5,
  overflow: "hidden",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.border,
})

const ProgressFill = styled.View({
  height: "100%",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.teal,
})

const Explanation = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})

const PrivacyNotice = styled.View({
  gap: 3,
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[3],
})

const PrivacyTitle = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 10,
  fontWeight: "600",
})

const PrivacyDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})

const BreakdownList = styled.View({ gap: mobileTheme.spacing[4] })

const BreakdownRow = styled.View({ gap: mobileTheme.spacing[2] })

const BreakdownHeading = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const BreakdownNameRow = styled.View({
  minWidth: 0,
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[2],
})

const CategoryMarker = styled.View({
  width: 8,
  height: 8,
  borderRadius: mobileTheme.radii.round,
})

const BreakdownName = styled(AppText)({
  minWidth: 0,
  flex: 1,
  color: mobileTheme.colors.ink,
  fontSize: 11,
  fontWeight: "600",
  lineHeight: 17,
})

const BreakdownValue = styled(AppText)<{ $warning: boolean }>(
  ({ $warning }) => ({
    color: $warning ? mobileTheme.colors.amber : mobileTheme.colors.muted,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "right",
  }),
)

const BreakdownTrack = styled.View({
  height: 6,
  overflow: "hidden",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.border,
})

const CategoryFill = styled.View({
  height: "100%",
  borderRadius: mobileTheme.radii.round,
})

const WeekFill = styled.View({
  height: "100%",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.teal,
})

const WarningLabel = styled(AppText)({
  color: mobileTheme.colors.amber,
  fontSize: 9,
  fontWeight: "700",
  textAlign: "right",
})

const EmptyText = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[4],
})

const ReadOnlyLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 9,
  fontWeight: "600",
})

const MonthNote = styled(AppText)<{ $empty: boolean }>(({ $empty }) => ({
  minHeight: 68,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
  color: $empty ? mobileTheme.colors.subtle : mobileTheme.colors.ink,
  fontSize: 11,
  lineHeight: 18,
  padding: mobileTheme.spacing[3],
}))

const RecentList = styled.View({ gap: mobileTheme.spacing[2] })

const RecentTransaction = styled.Pressable({
  minHeight: 72,
  borderTopWidth: 1,
  borderTopColor: mobileTheme.colors.border,
  paddingVertical: mobileTheme.spacing[3],
})

const RecentCopy = styled.View({ gap: 3 })

const RecentTopLine = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const RecentTitle = styled(AppText)({
  minWidth: 0,
  flex: 1,
  color: mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
})

const RecentAmount = styled(AppText)<{ $type: Transaction["type"] }>(
  ({ $type }) => ({
    color:
      $type === "income" ? mobileTheme.colors.green : mobileTheme.colors.ink,
    fontSize: 11,
    fontWeight: "600",
  }),
)

const RecentMeta = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})
