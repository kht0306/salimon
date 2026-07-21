"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { Category, Transaction, TransactionSplit } from "@salimon/types"
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
import {
  Button,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  Textarea,
} from "../styles"

export const SettlementPanel = observer(function SettlementPanel() {
  const store = useAppStore()
  const [chart, setChart] = useState<"bar" | "pie">("bar")
  const [monthNote, setMonthNote] = useState(
    store.selectedMonthNote?.note ?? "",
  )
  useEffect(() => {
    setMonthNote(store.selectedMonthNote?.note ?? "")
  }, [store.selectedMonth, store.selectedMonthNote?.note])
  const confirmedTransactions = store.monthTransactions.filter(
    (item) => item.status === "confirmed",
  )
  const excludedTransactions = store.monthTransactions.filter(
    (item) => item.status === "excluded",
  )
  const rows = store.expenseCategories
    .map((category) => {
      const spent = confirmedTransactions
        .filter((item) => item.type === "expense")
        .reduce(
          (sum, item) =>
            sum +
            categoryAmount(
              item,
              category.id,
              store.data.transactionSplits,
            ),
          0,
        )
      const budget =
        store.selectedMonthBudgets.find(
          (item) => item.category.id === category.id,
        )?.amount ?? 0
      return { category, spent, budget }
    })
    .filter((item) => item.spent > 0 || item.budget > 0)
  const max = Math.max(1, ...rows.map((item) => item.spent))
  const pieRows = rows.filter((item) => item.spent > 0)
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
  const overBudgetCount = rows.filter(
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
      const category = categoryName(
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
      ["거래일시", "정산 상태", "유형", "카테고리", "가맹점/내용", "메모", "태그", "행위자", "금액"],
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
    <PrintArea>
      <Panel>
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
              onClick={() => setChart("bar")}
            >
              <BarChart3 size={15} /> 막대
            </Button>
            <Button
              $variant={chart === "pie" ? "primary" : "ghost"}
              onClick={() => setChart("pie")}
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
            <span>이월, 환급, 공동 합의 등 거래만으로 설명하기 어려운 내용을 남기세요.</span>
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
              {changeRate === undefined ? "비교 없음" : `${Math.abs(changeRate)}%`}
            </strong>
            <small>
              {changeRate === undefined ? null : changeRate > 0 ? (
                <><TrendingUp size={13} /> 지출 증가</>
              ) : (
                <><TrendingDown size={13} /> 지출 감소</>
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
                  <i style={{ height: `${Math.max(6, (item.amount / trendMax) * 100)}%` }} />
                  <strong>{formatKrw(item.amount)}</strong>
                  <span>{item.month.slice(5)}월</span>
                </TrendItem>
              ))}
            </TrendBars>
          </InsightCard>
          <InsightCard>
            <h3><UsersRound size={15} /> 멤버별 기록 지출</h3>
            <ContributionRows>
              {memberRows.map(({ member, amount }) => (
                <div key={member.id}>
                  <span>{member.nickname}</span>
                  <strong>{formatKrw(amount)}</strong>
                </div>
              ))}
              {memberRows.length === 0 ? <Empty>행위자가 지정된 지출이 없습니다.</Empty> : null}
            </ContributionRows>
          </InsightCard>
          <InsightCard>
            <h3>주차별 공동생활비</h3>
            <ContributionRows>
              {weeklyRows.map((week) => (
                <div key={week.label}>
                  <span>{week.label} · {week.range} · {week.count}건</span>
                  <strong>{formatKrw(week.amount)}</strong>
                </div>
              ))}
            </ContributionRows>
          </InsightCard>
        </InsightGrid>

        <Section>
          <h3>{store.selectedMonth} 카테고리별 지출</h3>
          {chart === "bar" ? (
            <Bars>
              {rows.map(({ category, spent }) => (
                <BarRow key={category.id}>
                  <span>{categoryLabel(store.data.categories, category)}</span>
                  <Bar>
                    <i
                      style={{
                        width: `${(spent / max) * 100}%`,
                        background: category.color,
                      }}
                    />
                  </Bar>
                  <strong>{formatKrw(spent)}</strong>
                </BarRow>
              ))}
            </Bars>
          ) : (
            <PieChartLayout>
              <Pie style={{ background: pieGradient(pieRows) }}>
                <span>
                  {formatKrw(pieRows.reduce((sum, row) => sum + row.spent, 0))}
                </span>
              </Pie>
              <PieLegend aria-label="카테고리별 지출 범례">
                {pieRows.map(({ category, spent }) => (
                  <PieLegendItem key={category.id}>
                    <LegendLabel>
                      <LegendDot $color={category.color} />
                      {categoryLabel(store.data.categories, category)}
                    </LegendLabel>
                    <strong>{formatKrw(spent)}</strong>
                  </PieLegendItem>
                ))}
              </PieLegend>
            </PieChartLayout>
          )}
          {rows.length === 0 ? <Empty>확정 지출 또는 예산이 없습니다.</Empty> : null}
        </Section>

        <Section>
          <h3>예산 대비 실제 지출</h3>
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>예산</th>
                  <th>지출</th>
                  <th>잔액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ category, budget, spent }) => (
                  <tr key={category.id}>
                    <td>{categoryLabel(store.data.categories, category)}</td>
                    <td>{formatKrw(budget)}</td>
                    <td>{formatKrw(spent)}</td>
                    <td data-negative={budget > 0 && budget - spent < 0}>
                      {formatKrw(budget - spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        </Section>

        <Section>
          <h3>
            거래내역 {store.monthTransactions.length}건 · 정산 제외 {excludedTransactions.length}건
          </h3>
          <TransactionCards>
            {store.monthTransactions.map((item) => (
              <TransactionCard key={item.id} $excluded={item.status === "excluded"}>
                <div>
                  <strong>{item.merchantName || item.memo || "거래"}</strong>
                  <span>{categoryName(store.data.categories, item, store.data.transactionSplits)} · {actorName(store.currentMembers, item)}</span>
                </div>
                <div>
                  <StatusBadge $excluded={item.status === "excluded"}>
                    {item.status === "excluded" ? "정산 제외" : "정산 포함"}
                  </StatusBadge>
                  <strong>{formatKrw(item.amount)}</strong>
                  <time>{new Date(item.transactionAt).toLocaleString("ko-KR")}</time>
                </div>
              </TransactionCard>
            ))}
          </TransactionCards>
          <TableScroll>
            <DataTable className="desktop-table transaction-table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>정산</th>
                  <th>카테고리</th>
                  <th>내용</th>
                  <th>행위자</th>
                  <th>금액</th>
                </tr>
              </thead>
              <tbody>
                {store.monthTransactions.map((item) => (
                  <tr key={item.id} data-excluded={item.status === "excluded"}>
                    <td>{new Date(item.transactionAt).toLocaleString("ko-KR")}</td>
                    <td>
                      <StatusBadge $excluded={item.status === "excluded"}>
                        {item.status === "excluded" ? "제외" : "포함"}
                      </StatusBadge>
                    </td>
                    <td>{categoryName(store.data.categories, item, store.data.transactionSplits)}</td>
                    <td>
                      {item.merchantName || item.memo || "거래"}
                      {item.recurringType === "installment"
                        ? ` (${item.installmentNumber}/${item.installmentTotal}개월)`
                        : ""}
                    </td>
                    <td>{actorName(store.currentMembers, item)}</td>
                    <td>{formatKrw(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        </Section>
      </Panel>
    </PrintArea>
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

function categoryName(
  categories: Category[],
  transaction: Transaction,
  splits: TransactionSplit[],
) {
  const transactionSplits = splits.filter(
    (split) => split.transactionId === transaction.id,
  )
  if (transactionSplits.length > 0) {
    return transactionSplits
      .map(
        (split) =>
          `${categoryLabel(categories, categories.find((item) => item.id === split.categoryId))} ${formatKrw(split.amount)}`,
      )
      .join(" / ")
  }
  return categoryLabel(
    categories,
    categories.find((entry) => entry.id === transaction.categoryId),
  )
}

function categoryLabel(categories: Category[], category?: Category) {
  if (!category) return "기타"
  const parent = category.parentCategoryId
    ? categories.find((item) => item.id === category.parentCategoryId)
    : undefined
  return `${parent ? `${parent.name} › ` : ""}${category.name}`
}

function categoryAmount(
  transaction: Transaction,
  categoryId: string,
  splits: TransactionSplit[],
) {
  const transactionSplits = splits.filter(
    (split) => split.transactionId === transaction.id,
  )
  if (transactionSplits.length > 0) {
    return transactionSplits
      .filter((split) => split.categoryId === categoryId)
      .reduce((sum, split) => sum + split.amount, 0)
  }
  return transaction.categoryId === categoryId ? transaction.amount : 0
}

function actorName(
  members: { userId: string; nickname: string }[],
  transaction: Transaction,
) {
  if (!transaction.actorUserId) return "공통"
  return members.find((member) => member.userId === transaction.actorUserId)?.nickname ?? "탈퇴한 멤버"
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

function pieGradient(rows: { category: { color: string }; spent: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.spent, 0) || 1
  let offset = 0
  return `conic-gradient(${rows
    .map((row) => {
      const start = offset
      offset += (row.spent / total) * 100
      return `${row.category.color} ${start}% ${offset}%`
    })
    .join(",")})`
}

const PrintArea = styled.div`
  @media print {
    .no-print { display: none; }
  }
`
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  input { width: 145px; }
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
  svg { flex: 0 0 auto; margin-top: 1px; }
  strong { display: block; margin-bottom: 2px; }
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
  > div { display: grid; gap: 3px; align-self: start; }
  span { color: ${colors.muted}; font-size: 10px; }
  textarea { min-height: 64px; }
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`
const MetricCards = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 16px 18px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`
const MetricCard = styled.div<{ $alert?: boolean }>`
  display: grid;
  gap: 5px;
  border: 1px solid ${({ $alert }) => ($alert ? colors.coral : colors.border)};
  border-radius: ${radii.sm};
  background: ${({ $alert }) => ($alert ? colors.coralSoft : colors.panel)};
  padding: 13px;
  span { color: ${colors.muted}; font-size: 11px; }
  > strong { font-size: 18px; }
  small { display: flex; align-items: center; gap: 4px; color: ${colors.muted}; }
`
const InsightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px 18px;
  @media (max-width: 960px) { grid-template-columns: 1fr; }
`
const InsightCard = styled.section`
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  padding: 14px;
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 14px; font-size: 13px; }
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
  i { align-self: end; width: min(56px, 80%); justify-self: center; border-radius: 5px 5px 0 0; background: ${colors.teal}; }
  strong { margin-top: 5px; font-size: 11px; }
  span { color: ${colors.muted}; font-size: 10px; }
`
const ContributionRows = styled.div`
  display: grid;
  gap: 9px;
  > div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
`
const Section = styled.section`
  padding: 18px;
  h3 { margin: 0 0 14px; font-size: 14px; }
  & + & { border-top: 1px solid ${colors.border}; }
`
const Bars = styled.div`display: grid; gap: 10px;`
const BarRow = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(80px, 1fr) 100px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  strong { text-align: right; }
  @media (max-width: 520px) {
    grid-template-columns: minmax(65px, auto) 1fr;
    strong { grid-column: 2; grid-row: 2; }
  }
`
const Bar = styled.div`
  height: 16px;
  border-radius: ${radii.xs};
  background: ${colors.panelSubtle};
  overflow: hidden;
  i { display: block; height: 100%; }
`
const PieChartLayout = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  @media (max-width: 640px) { flex-direction: column; gap: 20px; }
`
const Pie = styled.div`
  width: 220px;
  height: 220px;
  flex: 0 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  span { display: grid; place-items: center; width: 110px; height: 110px; border-radius: 50%; background: ${colors.panel}; font-weight: 700; }
`
const PieLegend = styled.div`display: grid; gap: 10px; min-width: 190px;`
const PieLegendItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  font-size: 12px;
  strong { font-size: 12px; white-space: nowrap; }
`
const LegendLabel = styled.span`display: flex; align-items: center; gap: 8px; min-width: 0;`
const LegendDot = styled.i<{ $color: string }>`
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: ${radii.round};
  background: ${({ $color }) => $color};
`
const TableScroll = styled.div`overflow-x: auto;`
const DataTable = styled.table`
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 12px;
  th, td { padding: 9px; border-bottom: 1px solid ${colors.border}; text-align: left; }
  th { color: ${colors.muted}; }
  tr[data-excluded="true"] { color: ${colors.muted}; background: ${colors.panelSubtle}; }
  td[data-negative="true"] { color: ${colors.coral}; font-weight: 700; }
  &.transaction-table th:first-of-type,
  &.transaction-table td:first-of-type { width: 120px; }
  &.transaction-table th:nth-of-type(4),
  &.transaction-table td:nth-of-type(4) { width: 36%; }
  @media (max-width: 640px) { &.desktop-table { display: none; } }
`
const StatusBadge = styled.span<{ $excluded: boolean }>`
  display: inline-flex;
  border-radius: ${radii.round};
  background: ${({ $excluded }) => ($excluded ? colors.panelSubtle : colors.tealSoft)};
  color: ${({ $excluded }) => ($excluded ? colors.muted : colors.teal)};
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
`
const TransactionCards = styled.div`
  display: none;
  gap: 8px;
  @media (max-width: 640px) { display: grid; }
`
const TransactionCard = styled.article<{ $excluded: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${({ $excluded }) => ($excluded ? colors.panelSubtle : colors.panel)};
  padding: 11px;
  > div { display: grid; gap: 4px; }
  > div:last-child { justify-items: end; }
  span, time { color: ${colors.muted}; font-size: 10px; }
  strong { font-size: 12px; }
`
const Empty = styled.p`margin: 0; color: ${colors.muted}; font-size: 12px;`
