import styled from "@emotion/native"
import { ScrollView } from "react-native"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import type { MonthDaySummary } from "./dashboardPresentation"

interface DateSummaryStripProps {
  days: MonthDaySummary[]
  onSelect: (date: string) => void
  selectedDate: string
}

export function DateSummaryStrip({
  days,
  onSelect,
  selectedDate,
}: DateSummaryStripProps) {
  return (
    <Section>
      <SectionHeading>
        <SectionTitle>날짜별 요약</SectionTitle>
        <SectionHint>좌우로 밀어 날짜를 선택하세요.</SectionHint>
      </SectionHeading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={dateContentStyle}
      >
        {days.map((day) => {
          const selected = day.date === selectedDate
          return (
            <DayButton
              key={day.date}
              $selected={selected}
              accessibilityLabel={`${day.dayOfMonth}일, 거래 ${day.count}건, 지출 ${day.expense}원, 수입 ${day.income}원, 저축 ${day.saving}원`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(day.date)}
            >
              <DayNumber $selected={selected}>{day.dayOfMonth}일</DayNumber>
              <TransactionCount $selected={selected}>
                {day.count}건
              </TransactionCount>
              <AmountStack>
                {day.expense > 0 ? (
                  <DayAmount $selected={selected} $tone="expense">
                    지 {formatCompactAmount(day.expense)}
                  </DayAmount>
                ) : null}
                {day.income > 0 ? (
                  <DayAmount $selected={selected} $tone="income">
                    수 {formatCompactAmount(day.income)}
                  </DayAmount>
                ) : null}
                {day.saving > 0 ? (
                  <DayAmount $selected={selected} $tone="saving">
                    저 {formatCompactAmount(day.saving)}
                  </DayAmount>
                ) : null}
                {day.expense + day.income + day.saving === 0 ? (
                  <NoAmount $selected={selected}>—</NoAmount>
                ) : null}
              </AmountStack>
            </DayButton>
          )
        })}
      </ScrollView>
    </Section>
  )
}

function formatCompactAmount(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(amount)
}

const dateContentStyle = { gap: 8, paddingRight: 20 } as const

const Section = styled.View({ gap: mobileTheme.spacing[3] })

const SectionHeading = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const SectionTitle = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 15px;
  font-weight: 600;
`

const SectionHint = styled(AppText)`
  flex-shrink: 1;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
  text-align: right;
`

const DayButton = styled.Pressable<{ $selected: boolean }>(({ $selected }) => ({
  width: 68,
  minHeight: 94,
  gap: mobileTheme.spacing[1],
  borderWidth: 1,
  borderColor: $selected ? mobileTheme.colors.teal : mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: $selected
    ? mobileTheme.colors.tealSoft
    : mobileTheme.colors.panel,
  padding: mobileTheme.spacing[2],
}))

const DayNumber = styled(AppText)<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 600;
`

const TransactionCount = styled(AppText)<{ $selected: boolean }>`
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const AmountStack = styled.View({
  gap: 1,
  marginTop: mobileTheme.spacing[1],
})

const DayAmount = styled(AppText)<{
  $selected: boolean
  $tone: "expense" | "income" | "saving"
}>`
  color: ${({ $tone }) =>
    $tone === "income" ? mobileTheme.colors.green : mobileTheme.colors.muted};
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
`

const NoAmount = styled(AppText)<{ $selected: boolean }>`
  color: ${mobileTheme.colors.subtle};
  font-size: 10px;
`
