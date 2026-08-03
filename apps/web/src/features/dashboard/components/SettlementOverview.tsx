"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  BarChart3,
  Download,
  Info,
  PieChart,
  Printer,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Input, PanelHeader, PanelTitle, Textarea } from "../styles"
import {
  getSettlementCategoryName,
  type SettlementChart,
} from "./settlementPresentation"

interface SettlementOverviewProps {
  chart: SettlementChart
  onChartChange: (chart: SettlementChart) => void
}

export const SettlementOverview = observer(function SettlementOverview({
  chart,
  onChartChange,
}: SettlementOverviewProps) {
  const store = useAppStore()
  const [monthNote, setMonthNote] = useState(
    store.selectedMonthNote?.note ?? "",
  )
  useEffect(() => {
    setMonthNote(store.selectedMonthNote?.note ?? "")
  }, [store.selectedMonth, store.selectedMonthNote?.note])
  const confirmedTransactions = store.monthTransactions.filter(
    (item) => item.status === "confirmed",
  )
  const budgetRows = store.selectedMonthBudgets.map(
    ({ category, amount, spent }) => ({
      category,
      budget: amount,
      spent,
    }),
  )
  const expenseTotal = sumType(confirmedTransactions, "expense")
  const fixedExpense = confirmedTransactions
    .filter((item) => item.type === "expense" && item.recurringType === "fixed")
    .reduce((sum, item) => sum + item.amount, 0)
  const previousMonth = moveMonth(store.selectedMonth, -1)
  const previousExpense = store.data.transactions
    .filter(
      (item) =>
        item.ledgerId === store.selectedLedgerId &&
        item.status === "confirmed" &&
        item.type === "expense" &&
        !item.deletedAt &&
        item.transactionAt.slice(0, 7) === previousMonth,
    )
    .reduce((sum, item) => sum + item.amount, 0)
  const changeRate =
    previousExpense > 0
      ? Math.round(((expenseTotal - previousExpense) / previousExpense) * 100)
      : undefined
  const memberRows = store.currentMembers
    .map((member) => ({
      member,
      amount: confirmedTransactions
        .filter(
          (item) =>
            item.type === "expense" && item.actorUserId === member.userId,
        )
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const overBudgetCount = budgetRows.filter(
    (item) => item.budget > 0 && item.spent > item.budget,
  ).length
  const trendRows = [-2, -1, 0].map((offset) => {
    const month = moveMonth(store.selectedMonth, offset)
    const amount = store.data.transactions
      .filter(
        (item) =>
          item.ledgerId === store.selectedLedgerId &&
          item.status === "confirmed" &&
          item.type === "expense" &&
          !item.deletedAt &&
          item.transactionAt.slice(0, 7) === month,
      )
      .reduce((sum, item) => sum + item.amount, 0)
    return { month, amount }
  })
  const trendMax = Math.max(1, ...trendRows.map((item) => item.amount))
  const [selectedYear, selectedMonthNumber] = store.selectedMonth
    .split("-")
    .map(Number)
  const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate()
  const weeklyRows = Array.from(
    { length: Math.ceil(daysInMonth / 7) },
    (_, index) => {
      const startDay = index * 7 + 1
      const endDay = Math.min(daysInMonth, startDay + 6)
      const transactions = confirmedTransactions.filter((item) => {
        const day = new Date(item.transactionAt).getDate()
        return item.type === "expense" && day >= startDay && day <= endDay
      })
      return {
        label: `${index + 1}주차`,
        range: `${startDay}–${endDay}일`,
        amount: transactions.reduce((sum, item) => sum + item.amount, 0),
        count: transactions.length,
      }
    },
  )

  function exportExcel() {
    const transactions = store.monthTransactions.map((item) => {
      const category = getSettlementCategoryName(
        store.data.categories,
        item,
        store.data.transactionSplits,
      )
      const actor = item.actorUserId
        ? (store.currentMembers.find(
            (member) => member.userId === item.actorUserId,
          )?.nickname ?? "탈퇴한 멤버")
        : "공통"
      return [
        new Date(item.transactionAt).toLocaleString("ko-KR"),
        item.status === "confirmed" ? "정산 포함" : "정산 제외",
        item.type === "expense"
          ? "지출"
          : item.type === "income"
            ? "수입"
            : "저축",
        category,
        item.merchantName ?? "",
        item.memo ?? "",
        (item.tags ?? []).join(", "),
        actor,
        item.amount,
      ]
    })
    const table = [
      [
        "거래일시",
        "정산 상태",
        "유형",
        "카테고리",
        "가맹점/내용",
        "메모",
        "태그",
        "행위자",
        "금액",
      ],
      ...transactions,
    ]
    const html = `<html><head><meta charset="utf-8"></head><body><p>정산 합계는 '정산 포함' 거래만 계산합니다.</p><table>${table.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(spreadsheetSafeText(String(cell)))}</td>`).join("")}</tr>`).join("")}</table></body></html>`
    const link = document.createElement("a")
    link.href = URL.createObjectURL(
      new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }),
    )
    link.download = `salimon-${store.selectedMonth}-settlement.xls`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <>
      <PanelHeader>
        <PanelTitle>월 정산</PanelTitle>
        <Actions className="no-print">
          <Input
            type="month"
            value={store.selectedMonth}
            onChange={(event) => {
              store.selectedMonth = event.target.value
              void store.refreshFinanceData()
            }}
          />
          <Button
            $variant={chart === "bar" ? "primary" : "ghost"}
            onClick={() => onChartChange("bar")}
          >
            <BarChart3 size={15} /> 막대
          </Button>
          <Button
            $variant={chart === "pie" ? "primary" : "ghost"}
            onClick={() => onChartChange("pie")}
          >
            <PieChart size={15} /> 원형
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={15} /> 인쇄
          </Button>
          <Button onClick={exportExcel}>
            <Download size={15} /> Excel
          </Button>
        </Actions>
      </PanelHeader>

      <SettlementRule role="note">
        <Info size={16} />
        <span>
          <strong>정산 기준</strong> 확정 거래만 모든 합계·예산·차트에
          반영합니다. 제외 거래는 기록과 내보내기에 남지만 금액에는 반영하지
          않습니다.
        </span>
      </SettlementRule>

      <MonthNoteBox>
        <div>
          <strong>공동 월 정산 메모</strong>
          <span>
            이월, 환급, 공동 합의 등 거래만으로 설명하기 어려운 내용을 남기세요.
          </span>
        </div>
        <Textarea
          value={monthNote}
          maxLength={1000}
          disabled={store.currentLedger?.role === "viewer"}
          placeholder="예: 이번 달 공과금 30,000원은 다음 달에 이월 정산"
          onChange={(event) => setMonthNote(event.target.value)}
        />
        <Button
          type="button"
          $variant="soft"
          disabled={
            store.currentLedger?.role === "viewer" ||
            monthNote === (store.selectedMonthNote?.note ?? "")
          }
          onClick={() => void store.saveMonthNote(monthNote)}
        >
          메모 저장
        </Button>
      </MonthNoteBox>

      <MetricCards>
        <MetricCard>
          <span>확정 지출</span>
          <strong>{formatKrw(expenseTotal)}</strong>
          <small>{confirmedTransactions.length}건 정산 기준</small>
        </MetricCard>
        <MetricCard>
          <span>전월 대비</span>
          <strong>
            {changeRate === undefined
              ? "비교 없음"
              : `${Math.abs(changeRate)}%`}
          </strong>
          <small>
            {changeRate === undefined ? null : changeRate > 0 ? (
              <>
                <TrendingUp size={13} /> 지출 증가
              </>
            ) : (
              <>
                <TrendingDown size={13} /> 지출 감소
              </>
            )}
          </small>
        </MetricCard>
        <MetricCard>
          <span>고정비 / 변동비</span>
          <strong>{formatKrw(fixedExpense)}</strong>
          <small>변동비 {formatKrw(expenseTotal - fixedExpense)}</small>
        </MetricCard>
        <MetricCard $alert={overBudgetCount > 0}>
          <span>예산 초과</span>
          <strong>{overBudgetCount}개</strong>
          <small>카테고리별 예산 기준</small>
        </MetricCard>
      </MetricCards>

      <InsightGrid>
        <InsightCard>
          <h3>최근 3개월 지출</h3>
          <TrendBars>
            {trendRows.map((item) => (
              <TrendItem key={item.month}>
                <i
                  style={{
                    height: `${Math.max(6, (item.amount / trendMax) * 100)}%`,
                  }}
                />
                <strong>{formatKrw(item.amount)}</strong>
                <span>{item.month.slice(5)}월</span>
              </TrendItem>
            ))}
          </TrendBars>
        </InsightCard>
        <InsightCard>
          <h3>
            <UsersRound size={15} /> 멤버별 기록 지출
          </h3>
          <ContributionRows>
            {memberRows.map(({ member, amount }) => (
              <div key={member.id}>
                <span>{member.nickname}</span>
                <strong>{formatKrw(amount)}</strong>
              </div>
            ))}
            {memberRows.length === 0 ? (
              <Empty>행위자가 지정된 지출이 없습니다.</Empty>
            ) : null}
          </ContributionRows>
        </InsightCard>
        <InsightCard>
          <h3>주차별 공동생활비</h3>
          <ContributionRows>
            {weeklyRows.map((week) => (
              <div key={week.label}>
                <span>
                  {week.label} · {week.range} · {week.count}건
                </span>
                <strong>{formatKrw(week.amount)}</strong>
              </div>
            ))}
          </ContributionRows>
        </InsightCard>
      </InsightGrid>
    </>
  )
})

function sumType(items: Transaction[], type: Transaction["type"]) {
  return items
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + item.amount, 0)
}

function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(year, monthNumber - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  )
}

function spreadsheetSafeText(value: string) {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
}

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  input {
    width: 145px;
  }
`
const SettlementRule = styled.div`
  display: flex;
  gap: 10px;
  margin: 16px 18px 0;
  border: 1px solid ${colors.blue};
  border-radius: ${radii.sm};
  background: ${colors.blueSoft};
  color: ${colors.blue};
  padding: 12px;
  font-size: 12px;
  svg {
    flex: 0 0 auto;
    margin-top: 1px;
  }
  strong {
    display: block;
    margin-bottom: 2px;
  }
`
const MonthNoteBox = styled.section`
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.6fr) auto;
  align-items: end;
  gap: 10px;
  margin: 12px 18px 0;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  padding: 12px;
  > div {
    display: grid;
    gap: 3px;
    align-self: start;
  }
  span {
    color: ${colors.muted};
    font-size: 10px;
  }
  textarea {
    min-height: 64px;
  }
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`
const MetricCards = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 16px 18px;
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`
const MetricCard = styled.div<{ $alert?: boolean }>`
  display: grid;
  gap: 5px;
  border: 1px solid ${({ $alert }) => ($alert ? colors.coral : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $alert }) => ($alert ? colors.coralSoft : colors.panel)};
  padding: 13px;
  span {
    color: ${colors.muted};
    font-size: 11px;
  }
  > strong {
    font-size: 18px;
  }
  small {
    display: flex;
    align-items: center;
    gap: 4px;
    color: ${colors.muted};
  }
`
const InsightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px 18px;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`
const InsightCard = styled.section`
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  padding: 14px;
  h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 14px;
    font-size: 13px;
  }
`
const TrendBars = styled.div`
  height: 130px;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 12px;
`
const TrendItem = styled.div`
  height: 100%;
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto auto;
  align-items: end;
  text-align: center;
  i {
    align-self: end;
    width: min(56px, 80%);
    justify-self: center;
    border-radius: 5px 5px 0 0;
    background: ${colors.teal};
  }
  strong {
    margin-top: 5px;
    font-size: 11px;
  }
  span {
    color: ${colors.muted};
    font-size: 10px;
  }
`
const ContributionRows = styled.div`
  display: grid;
  gap: 9px;
  > div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }
`

const Empty = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 12px;
`
