import styled from "@emotion/native"
import { useEffect, useRef } from "react"
import { ScrollView } from "react-native"
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
  const scrollRef = useRef<ScrollView>(null)
  const selectedDayIndex = days.findIndex((day) => day.date === selectedDate)

  useEffect(() => {
    if (selectedDayIndex < 0) return
    scrollRef.current?.scrollTo({
      animated: false,
      x: Math.max(0, selectedDayIndex * 78 - 24),
    })
  }, [selectedDayIndex])

  return (
    <Section>
      <SectionHeading>
        <SectionTitle>날짜별 요약</SectionTitle>
        <SectionHint>좌우로 밀어 날짜를 선택하세요.</SectionHint>
      </SectionHeading>
      <ScrollView
        ref={scrollRef}
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
                  <DayAmount $tone="expense">
                    지 {formatCompactAmount(day.expense)}
                  </DayAmount>
                ) : null}
                {day.income > 0 ? (
                  <DayAmount $tone="income">
                    수 {formatCompactAmount(day.income)}
                  </DayAmount>
                ) : null}
                {day.saving > 0 ? (
                  <DayAmount $tone="saving">
                    저 {formatCompactAmount(day.saving)}
                  </DayAmount>
                ) : null}
                {day.expense + day.income + day.saving === 0 ? (
                  <NoAmount>—</NoAmount>
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

const Section = styled.View`
  gap: ${mobileTheme.spacing[3]}px;
`

const SectionHeading = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: ${mobileTheme.spacing[3]}px;
`

const SectionTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
`

const SectionHint = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  line-height: 15px;
  text-align: right;
`

const DayButton = styled.Pressable<{ $selected: boolean }>`
  width: 70px;
  min-height: 104px;
  gap: ${mobileTheme.spacing[1]}px;
  border-width: 1px;
  border-color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.sm}px;
  background-color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.tealSoft : mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[2]}px;
`

const DayNumber = styled.Text<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 800;
`

const TransactionCount = styled.Text<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const AmountStack = styled.View`
  gap: 1px;
  margin-top: ${mobileTheme.spacing[1]}px;
`

const DayAmount = styled.Text<{
  $tone: "expense" | "income" | "saving"
}>`
  color: ${({ $tone }) =>
    $tone === "income"
      ? mobileTheme.colors.green
      : $tone === "expense"
        ? mobileTheme.colors.coral
        : mobileTheme.colors.teal};
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
`

const NoAmount = styled.Text`
  color: ${mobileTheme.colors.subtle};
  font-size: 10px;
`
