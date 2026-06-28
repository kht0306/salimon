export interface CalendarDay {
  date: string
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
}

export function toDateKey(date: Date): string {
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function fromMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number)
  return new Date(year, month - 1, 1)
}

export function moveMonth(monthKey: string, amount: number): string {
  const base = fromMonthKey(monthKey)
  base.setMonth(base.getMonth() + amount)
  return toMonthKey(base)
}

export function buildMonthCalendar(monthKey: string, now = new Date()): CalendarDay[] {
  const base = fromMonthKey(monthKey)
  const first = new Date(base.getFullYear(), base.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    return {
      date: toDateKey(date),
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === base.getMonth(),
      isToday: toDateKey(date) === toDateKey(now),
    }
  })
}

export function formatKoreanDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return `${year}년 ${month}월 ${day}일`
}

export function formatKoreanTime(iso: string): string {
  const date = new Date(iso)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours < 12 ? "오전" : "오후"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12

  return `${period} ${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function getDateTimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
