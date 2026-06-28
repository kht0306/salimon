"use client"

import styled from "@emotion/styled"
import { buildMonthCalendar, formatKrw, fromMonthKey, toDateKey } from "@salimon/domain"
import { colors } from "@salimon/ui-tokens"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, IconButton, Panel, PanelHeader, PanelTitle } from "../styles"

export const CalendarGrid = observer(function CalendarGrid() {
  const store = useAppStore()
  const days = useMemo(() => buildMonthCalendar(store.selectedMonth), [store.selectedMonth])
  const baseMonth = fromMonthKey(store.selectedMonth)
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"]

  return (
    <Panel>
      <PanelHeader>
        <MonthControls>
          <IconButton title="이전 달" onClick={() => store.moveSelectedMonth(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <PanelTitle>
            {baseMonth.getFullYear()}년 {baseMonth.getMonth() + 1}월
          </PanelTitle>
          <IconButton title="다음 달" onClick={() => store.moveSelectedMonth(1)}>
            <ChevronRight size={18} />
          </IconButton>
        </MonthControls>
        <Button
          $variant="primary"
          onClick={() => {
            store.selectDate(toDateKey(new Date()))
          }}
        >
          <Plus size={16} /> 오늘
        </Button>
      </PanelHeader>

      <WeekHeader>
        {weekdayLabels.map((label) => (
          <Weekday key={label}>{label}</Weekday>
        ))}
      </WeekHeader>
      <Grid>
        {days.map((day) => {
          const transactions = store.monthTransactions.filter(
            (transaction) => toDateKey(new Date(transaction.transactionAt)) === day.date,
          )
          const expense = transactions
            .filter((transaction) => transaction.type === "expense" && transaction.status !== "excluded")
            .reduce((sum, transaction) => sum + transaction.amount, 0)
          const income = transactions
            .filter((transaction) => transaction.type === "income" && transaction.status !== "excluded")
            .reduce((sum, transaction) => sum + transaction.amount, 0)

          return (
            <DayCell
              key={day.date}
              type="button"
              $selected={store.selectedDate === day.date}
              $muted={!day.isCurrentMonth}
              onClick={() => store.selectDate(day.date)}
            >
              <DayTop>
                <DayNumber $today={day.isToday}>{day.dayOfMonth}</DayNumber>
                {transactions.length > 0 ? <Count>{transactions.length}</Count> : null}
              </DayTop>
              <DayAmounts>
                {expense > 0 ? <Expense>-{formatKrw(expense)}</Expense> : null}
                {income > 0 ? <Income>+{formatKrw(income)}</Income> : null}
              </DayAmounts>
            </DayCell>
          )
        })}
      </Grid>
    </Panel>
  )
})

const MonthControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding: 10px 12px 0;
`

const Weekday = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 750;
  text-align: center;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  padding: 12px;

  @media (max-width: 640px) {
    padding: 8px;
  }
`

const DayCell = styled.button<{ $selected: boolean; $muted: boolean }>`
  min-width: 0;
  min-height: 104px;
  aspect-ratio: 1.1 / 1;
  border: 1px solid ${({ $selected }) => ($selected ? colors.teal : colors.border)};
  border-radius: 8px;
  background: ${({ $selected }) => ($selected ? "#eef7f4" : "#fff")};
  color: ${({ $muted }) => ($muted ? "#a1aaa3" : colors.ink)};
  padding: 9px;
  text-align: left;
  overflow: hidden;

  @media (max-width: 640px) {
    min-height: 74px;
    padding: 6px;
  }
`

const DayTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`

const DayNumber = styled.span<{ $today: boolean }>`
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: ${({ $today }) => ($today ? colors.ink : "transparent")};
  color: ${({ $today }) => ($today ? "#fff" : "inherit")};
  font-weight: 800;
`

const Count = styled.span`
  min-width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #f1efe7;
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 800;
`

const DayAmounts = styled.div`
  display: grid;
  gap: 3px;
  margin-top: 9px;
  font-size: 12px;
  font-weight: 760;

  @media (max-width: 640px) {
    font-size: 10px;
  }
`

const Expense = styled.div`
  color: ${colors.coral};
  overflow: hidden;
  text-overflow: ellipsis;
`

const Income = styled.div`
  color: ${colors.green};
  overflow: hidden;
  text-overflow: ellipsis;
`
