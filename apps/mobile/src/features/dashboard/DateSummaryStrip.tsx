import styled from "@emotion/native"
import { formatKrw } from "@salimon/domain"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import type { MonthDaySummary } from "./dashboardPresentation"

interface DateSummaryStripProps {
  days: MonthDaySummary[]
  onSelect: (date: string) => void
  selectedDate: string
  selectedMonth: string
}

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"]

export function DateSummaryStrip({
  days,
  onSelect,
  selectedDate,
  selectedMonth,
}: DateSummaryStripProps) {
  const selectedDay = days.find((day) => day.date === selectedDate)
  const [year = 0, month = 1] = selectedMonth.split("-").map(Number)
  const leadingBlankCount = new Date(year, month - 1, 1).getDay()
  const cellCount = Math.ceil((leadingBlankCount + days.length) / 7) * 7
  const cells = Array.from({ length: cellCount }, (_, index) =>
    index < leadingBlankCount ? undefined : days[index - leadingBlankCount],
  )

  return (
    <Section>
      <SectionHeading>
        <SectionTitle>월 캘린더</SectionTitle>
        <SectionHint>
          {selectedDay
            ? `${month}월 ${selectedDay.dayOfMonth}일 · ${selectedDay.count}건`
            : "날짜를 선택하세요."}
        </SectionHint>
      </SectionHeading>
      <CalendarPanel>
        <WeekHeader>
          {weekdayLabels.map((label, index) => (
            <Weekday key={label} $weekend={index === 0 || index === 6}>
              {label}
            </Weekday>
          ))}
        </WeekHeader>
        <CalendarGrid>
          {cells.map((day, index) => {
            const selected = day?.date === selectedDate
            const lastColumn = index % 7 === 6
            const lastRow = index >= cells.length - 7
            if (!day) {
              return (
                <BlankCell
                  key={`blank-${index}`}
                  $lastColumn={lastColumn}
                  $lastRow={lastRow}
                />
              )
            }

            return (
              <DayButton
                key={day.date}
                $lastColumn={lastColumn}
                $lastRow={lastRow}
                $selected={selected}
                accessibilityLabel={`${day.dayOfMonth}일, 거래 ${day.count}건, 지출 ${formatKrw(day.expense)}, 수입 ${formatKrw(day.income)}, 저축 ${formatKrw(day.saving)}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(day.date)}
              >
                <DayTop>
                  <DayNumber $selected={selected}>{day.dayOfMonth}</DayNumber>
                  {day.count > 0 ? (
                    <TransactionCount $selected={selected}>
                      {day.count}
                    </TransactionCount>
                  ) : null}
                </DayTop>
                <AmountDots>
                  {day.expense > 0 ? <AmountDot $tone="expense" /> : null}
                  {day.income > 0 ? <AmountDot $tone="income" /> : null}
                  {day.saving > 0 ? <AmountDot $tone="saving" /> : null}
                </AmountDots>
              </DayButton>
            )
          })}
        </CalendarGrid>
      </CalendarPanel>
      {selectedDay && selectedDay.count > 0 ? (
        <SelectedSummary>
          <SelectedSummaryItem>
            지출 {formatKrw(selectedDay.expense)}
          </SelectedSummaryItem>
          <SelectedSummaryItem $tone="income">
            수입 {formatKrw(selectedDay.income)}
          </SelectedSummaryItem>
          <SelectedSummaryItem>
            저축 {formatKrw(selectedDay.saving)}
          </SelectedSummaryItem>
        </SelectedSummary>
      ) : null}
    </Section>
  )
}

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

const SectionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  ...mobileTheme.typography.section,
})

const SectionHint = styled(AppText)({
  flexShrink: 1,
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
  textAlign: "right",
})

const CalendarPanel = styled.View({
  overflow: "hidden",
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
})

const WeekHeader = styled.View({
  flexDirection: "row",
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panelSubtle,
})

const Weekday = styled(AppText)<{ $weekend: boolean }>(({ $weekend }) => ({
  width: `${100 / 7}%`,
  color: $weekend ? mobileTheme.colors.subtle : mobileTheme.colors.muted,
  fontSize: 10,
  fontWeight: "600",
  lineHeight: 30,
  textAlign: "center",
}))

const CalendarGrid = styled.View({ flexDirection: "row", flexWrap: "wrap" })

interface CalendarCellStyleProps {
  $lastColumn: boolean
  $lastRow: boolean
}

const BlankCell = styled.View<CalendarCellStyleProps>(
  ({ $lastColumn, $lastRow }) => ({
    width: `${100 / 7}%`,
    minHeight: 54,
    borderRightWidth: $lastColumn ? 0 : 1,
    borderRightColor: mobileTheme.colors.border,
    borderBottomWidth: $lastRow ? 0 : 1,
    borderBottomColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.panelSubtle,
  }),
)

const DayButton = styled.Pressable<
  CalendarCellStyleProps & { $selected: boolean }
>(({ $lastColumn, $lastRow, $selected }) => ({
  width: `${100 / 7}%`,
  minHeight: 54,
  gap: mobileTheme.spacing[2],
  borderRightWidth: $lastColumn ? 0 : 1,
  borderRightColor: mobileTheme.colors.border,
  borderBottomWidth: $lastRow ? 0 : 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: $selected
    ? mobileTheme.colors.tealSoft
    : mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[2],
  ...($selected
    ? {
        borderWidth: 1,
        borderColor: mobileTheme.colors.teal,
      }
    : {}),
}))

const DayTop = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
})

const DayNumber = styled(AppText)<{ $selected: boolean }>(({ $selected }) => ({
  color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
}))

const TransactionCount = styled(AppText)<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted,
    fontSize: 9,
    fontWeight: "700",
  }),
)

const AmountDots = styled.View({
  minHeight: 5,
  flexDirection: "row",
  alignItems: "center",
  gap: 3,
})

const AmountDot = styled.View<{
  $tone: "expense" | "income" | "saving"
}>(({ $tone }) => ({
  width: 5,
  height: 5,
  borderRadius: mobileTheme.radii.round,
  backgroundColor:
    $tone === "income"
      ? mobileTheme.colors.green
      : $tone === "saving"
        ? mobileTheme.colors.teal
        : mobileTheme.colors.ink,
}))

const SelectedSummary = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[3],
})

const SelectedSummaryItem = styled(AppText)<{ $tone?: "income" }>(
  ({ $tone }) => ({
    color:
      $tone === "income" ? mobileTheme.colors.green : mobileTheme.colors.muted,
    fontSize: 10,
    fontWeight: "600",
  }),
)
