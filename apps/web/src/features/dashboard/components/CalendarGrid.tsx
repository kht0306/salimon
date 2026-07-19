"use client"

import styled from "@emotion/styled"
import {
  buildMonthCalendar,
  formatKrw,
  fromMonthKey,
  toDateKey,
} from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  IconButton,
  Panel,
  PanelHeader,
  PanelTitle,
  Select,
} from "../styles"

export const CalendarGrid = observer(function CalendarGrid() {
  const store = useAppStore()
  const days = useMemo(
    () => buildMonthCalendar(store.selectedMonth),
    [store.selectedMonth],
  )
  const baseMonth = fromMonthKey(store.selectedMonth)
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"]

  function selectDate(date: string) {
    if (
      date === store.selectedDate &&
      store.selectedMonth === date.slice(0, 7)
    ) {
      return
    }
    if (
      store.transactionEditorOpen &&
      store.transactionEditorDirty &&
      !window.confirm("작성 중인 거래 등록 또는 수정을 취소하시겠습니까?")
    ) {
      return
    }
    store.setTransactionEditorOpen(false)
    store.selectDate(date)
  }

  return (
    <CalendarStack>
      {store.selectedMonthBudgets.length > 0 ? (
        <BudgetStrip>
          {store.selectedMonthBudgets.map(({ category, amount, spent }) => (
            <BudgetCard key={category.id} $color={category.color}>
              <strong>
                <CategoryDot $color={category.color} />
                {category.name}
              </strong>
              <span>
                {formatKrw(spent)} / {formatKrw(amount)}
              </span>
              <Progress>
                <i
                  style={{
                    width: `${Math.min(100, amount ? (spent / amount) * 100 : 0)}%`,
                    background: category.color,
                  }}
                />
              </Progress>
            </BudgetCard>
          ))}
        </BudgetStrip>
      ) : null}
      <Panel>
        <PanelHeader>
          <MonthControls>
            <IconButton
              title="이전 달"
              onClick={() => store.moveSelectedMonth(-1)}
            >
              <ChevronLeft size={18} />
            </IconButton>
            <PanelTitle>
              {baseMonth.getFullYear()}년 {baseMonth.getMonth() + 1}월
            </PanelTitle>
            <IconButton
              title="다음 달"
              onClick={() => store.moveSelectedMonth(1)}
            >
              <ChevronRight size={18} />
            </IconButton>
          </MonthControls>
          <CalendarActions>
            <RegistrantFilter>
              <span>등록자</span>
              <Select
                aria-label="캘린더 등록자 필터"
                value={store.calendarRegistrantId}
                onChange={(event) =>
                  store.setCalendarRegistrant(event.target.value)
                }
              >
                <option value="">전체</option>
                {store.currentMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.nickname}
                  </option>
                ))}
              </Select>
            </RegistrantFilter>
            <Button
              $variant="primary"
              onClick={() => {
                selectDate(toDateKey(new Date()))
              }}
            >
              <CalendarCheck2 size={15} /> 오늘
            </Button>
          </CalendarActions>
        </PanelHeader>

        <CalendarViewport>
          <CalendarBody>
            <WeekHeader>
              {weekdayLabels.map((label) => (
                <Weekday key={label}>{label}</Weekday>
              ))}
            </WeekHeader>
            <Grid>
              {days.map((day) => {
                const transactions = store.calendarMonthTransactions.filter(
                  (transaction) =>
                    toDateKey(new Date(transaction.transactionAt)) === day.date,
                )
                const expense = transactions
                  .filter(
                    (transaction) =>
                      transaction.type === "expense" &&
                      transaction.status !== "excluded",
                  )
                  .reduce((sum, transaction) => sum + transaction.amount, 0)
                const income = transactions
                  .filter(
                    (transaction) =>
                      transaction.type === "income" &&
                      transaction.status !== "excluded",
                  )
                  .reduce((sum, transaction) => sum + transaction.amount, 0)
                const saving = transactions
                  .filter(
                    (transaction) =>
                      transaction.type === "saving" &&
                      transaction.status !== "excluded",
                  )
                  .reduce((sum, transaction) => sum + transaction.amount, 0)

                return (
                  <DayCell
                    key={day.date}
                    type="button"
                    aria-label={`${day.date}, 거래 ${transactions.length}건`}
                    aria-pressed={store.selectedDate === day.date}
                    $selected={store.selectedDate === day.date}
                    $muted={!day.isCurrentMonth}
                    onClick={() => selectDate(day.date)}
                  >
                    <DayTop>
                      <DayNumber $today={day.isToday}>
                        {day.dayOfMonth}
                      </DayNumber>
                      {transactions.length > 0 ? (
                        <Count>{transactions.length}</Count>
                      ) : null}
                    </DayTop>
                    <DayAmounts>
                      {expense > 0 ? (
                        <Expense>{formatKrw(expense)}</Expense>
                      ) : null}
                      {income > 0 ? <Income>{formatKrw(income)}</Income> : null}
                      {saving > 0 ? <Saving>{formatKrw(saving)}</Saving> : null}
                    </DayAmounts>
                  </DayCell>
                )
              })}
            </Grid>
          </CalendarBody>
        </CalendarViewport>
      </Panel>
    </CalendarStack>
  )
})

const CalendarStack = styled.div`
  display: grid;
  gap: 14px;
`
const BudgetStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
`
const BudgetCard = styled.div<{ $color: string }>`
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid ${({ $color }) => $color};
  border-left-width: 4px;
  border-radius: ${radii.sm};
  background: ${colors.panel};
  strong {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`
const CategoryDot = styled.i<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`
const Progress = styled.div`
  height: 5px;
  overflow: hidden;
  border-radius: 4px;
  background: ${colors.panelSubtle};
  i {
    display: block;
    height: 100%;
  }
`

const MonthControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  h2 {
    min-width: 104px;
    text-align: center;
  }
`

const CalendarActions = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px;
`

const RegistrantFilter = styled.label`
  display: grid;
  gap: 3px;
  color: ${colors.muted};
  font-size: 10px;
  font-weight: 600;

  select {
    min-width: 112px;
    padding: 7px 28px 7px 9px;
    font-size: 12px;
  }
`

const CalendarViewport = styled.div`
  overflow-x: auto;
`

const CalendarBody = styled.div`
  min-width: 680px;

  @media (max-width: 640px) {
    min-width: 0;
  }
`

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
`

const Weekday = styled.div`
  color: ${colors.muted};
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
`

const DayCell = styled.button<{ $selected: boolean; $muted: boolean }>`
  min-width: 0;
  min-height: 108px;
  border: 0;
  border-right: 1px solid ${colors.border};
  border-bottom: 1px solid ${colors.border};
  border-radius: 0;
  background: ${({ $selected, $muted }) =>
    $selected ? colors.tealSoft : $muted ? colors.panelSubtle : colors.panel};
  color: ${({ $muted }) => ($muted ? colors.subtle : colors.ink)};
  padding: 10px;
  text-align: left;
  overflow: hidden;
  box-shadow: ${({ $selected }) =>
    $selected ? `inset 0 0 0 1px ${colors.teal}` : "none"};
  transition:
    background-color 140ms ease,
    box-shadow 140ms ease;

  &:nth-of-type(7n) {
    border-right: 0;
  }

  &:nth-last-of-type(-n + 7) {
    border-bottom: 0;
  }

  &:hover {
    background: ${({ $selected }) =>
      $selected ? colors.tealSoft : colors.panelSubtle};
  }

  @media (max-width: 640px) {
    min-height: 76px;
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
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border-radius: ${radii.round};
  background: ${({ $today }) => ($today ? colors.ink : "transparent")};
  color: ${({ $today }) => ($today ? colors.panel : "inherit")};
  font-size: 12px;
  font-weight: 650;

  @media (max-width: 640px) {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }
`

const Count = styled.span`
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: ${radii.round};
  background: ${colors.panelSubtle};
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 650;
`

const DayAmounts = styled.div`
  display: grid;
  gap: 2px;
  margin-top: 10px;
  font-family: var(--font-geist-mono);
  font-size: 11px;
  font-weight: 600;

  @media (max-width: 640px) {
    margin-top: 6px;
    font-size: 9px;
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

const Saving = styled.div`
  color: ${colors.violet};
  overflow: hidden;
  text-overflow: ellipsis;
`
