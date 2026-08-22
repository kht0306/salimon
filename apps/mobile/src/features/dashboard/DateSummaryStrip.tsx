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
  const selectedDay = days.find((day) => day.date === selectedDate)

  return (
    <Section>
      <SectionHeading>
        <SectionTitle>날짜별 요약</SectionTitle>
        <SectionHint>
          {selectedDay
            ? `${Number(selectedDate.slice(5, 7))}월 ${selectedDay.dayOfMonth}일 · ${selectedDay.count}건`
            : "날짜를 선택하세요."}
        </SectionHint>
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
            </DayButton>
          )
        })}
      </ScrollView>
    </Section>
  )
}

const dateContentStyle = { gap: 6, paddingRight: 16 } as const

const Section = styled.View({
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingBottom: mobileTheme.spacing[4],
})

const SectionHeading = styled.View({
  flexDirection: "row",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const SectionTitle = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: ${mobileTheme.typography.section.fontSize}px;
  font-weight: ${mobileTheme.typography.section.fontWeight};
  line-height: ${mobileTheme.typography.section.lineHeight}px;
`

const SectionHint = styled(AppText)`
  flex-shrink: 1;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
  text-align: right;
`

const DayButton = styled.Pressable<{ $selected: boolean }>(({ $selected }) => ({
  width: 60,
  minHeight: 64,
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
