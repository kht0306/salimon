"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { BarChart3, Download, PieChart, Printer } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Input, Panel, PanelHeader, PanelTitle } from "../styles"

export const SettlementPanel = observer(function SettlementPanel() {
  const store = useAppStore()
  const [chart, setChart] = useState<"bar" | "pie">("bar")
  const rows = store.expenseCategories
    .map((category) => {
      const spent = store.monthTransactions
        .filter(
          (item) =>
            item.type === "expense" &&
            item.status !== "excluded" &&
            item.categoryId === category.id,
        )
        .reduce((sum, item) => sum + item.amount, 0)
      const budget =
        store.selectedMonthBudgets.find(
          (item) => item.category.id === category.id,
        )?.amount ?? 0
      return { category, spent, budget }
    })
    .filter((item) => item.spent > 0 || item.budget > 0)
  const max = Math.max(1, ...rows.map((item) => item.spent))
  const pieRows = rows.filter((item) => item.spent > 0)

  function exportExcel() {
    const transactions = store.monthTransactions.map((item) => {
      const category =
        store.data.categories.find((entry) => entry.id === item.categoryId)
          ?.name ?? "기타"
      const actor = item.actorUserId
        ? (store.currentMembers.find(
            (member) => member.userId === item.actorUserId,
          )?.nickname ?? "알 수 없음")
        : "공통"
      return [
        new Date(item.transactionAt).toLocaleString("ko-KR"),
        item.type === "expense"
          ? "지출"
          : item.type === "income"
            ? "수입"
            : "이체",
        category,
        item.merchantName ?? "",
        item.memo ?? "",
        actor,
        item.amount,
      ]
    })
    const table = [
      ["거래일시", "유형", "카테고리", "가맹점/내용", "메모", "행위자", "금액"],
      ...transactions,
    ]
    const html = `<html><head><meta charset="utf-8"></head><body><table>${table.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("")}</table></body></html>`
    const link = document.createElement("a")
    link.href = URL.createObjectURL(
      new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }),
    )
    link.download = `salimon-${store.selectedMonth}-transactions.xls`
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
        <Section>
          <h3>{store.selectedMonth} 카테고리별 지출</h3>
          {chart === "bar" ? (
            <Bars>
              {rows.map(({ category, spent }) => (
                <BarRow key={category.id}>
                  <span>{category.name}</span>
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
                  {formatKrw(
                    pieRows.reduce((sum, row) => sum + row.spent, 0),
                  )}
                </span>
              </Pie>
              <PieLegend aria-label="카테고리별 지출 범례">
                {pieRows.map(({ category, spent }) => (
                  <PieLegendItem key={category.id}>
                    <LegendLabel>
                      <LegendDot $color={category.color} />
                      {category.name}
                    </LegendLabel>
                    <strong>{formatKrw(spent)}</strong>
                  </PieLegendItem>
                ))}
              </PieLegend>
            </PieChartLayout>
          )}
        </Section>
        <Section>
          <h3>예산 대비 실제 지출</h3>
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
                  <td>{category.name}</td>
                  <td>{formatKrw(budget)}</td>
                  <td>{formatKrw(spent)}</td>
                  <td>{formatKrw(budget - spent)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Section>
        <Section>
          <h3>전체 거래내역 ({store.monthTransactions.length}건)</h3>
          <DataTable>
            <thead>
              <tr>
                <th>일시</th>
                <th>카테고리</th>
                <th>내용</th>
                <th>행위자</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              {store.monthTransactions.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.transactionAt).toLocaleString("ko-KR")}
                  </td>
                  <td>
                    {store.data.categories.find(
                      (entry) => entry.id === item.categoryId,
                    )?.name ?? "기타"}
                  </td>
                  <td>
                    {item.merchantName || item.memo || "거래"}
                    {item.recurringType === "installment"
                      ? ` (${item.installmentNumber}/${item.installmentTotal}개월)`
                      : ""}
                  </td>
                  <td>
                    {item.actorUserId
                      ? (store.currentMembers.find(
                          (member) => member.userId === item.actorUserId,
                        )?.nickname ?? "알 수 없음")
                      : "공통"}
                  </td>
                  <td>{formatKrw(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Section>
      </Panel>
    </PrintArea>
  )
})

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  )
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
    .no-print {
      display: none;
    }
  }
`
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  input {
    width: 145px;
  }
`
const Section = styled.section`
  padding: 18px;
  h3 {
    margin: 0 0 14px;
    font-size: 14px;
  }
  & + & {
    border-top: 1px solid ${colors.border};
  }
`
const Bars = styled.div`
  display: grid;
  gap: 10px;
`
const BarRow = styled.div`
  display: grid;
  grid-template-columns: 90px 1fr 100px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  strong {
    text-align: right;
  }
`
const Bar = styled.div`
  height: 16px;
  border-radius: ${radii.xs};
  background: ${colors.panelSubtle};
  overflow: hidden;
  i {
    display: block;
    height: 100%;
  }
`
const PieChartLayout = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 20px;
  }
`
const Pie = styled.div`
  width: 220px;
  height: 220px;
  flex: 0 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  span {
    display: grid;
    place-items: center;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: white;
    font-weight: 700;
  }
`
const PieLegend = styled.div`
  display: grid;
  gap: 10px;
  min-width: 190px;
`
const PieLegendItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  font-size: 12px;

  strong {
    font-size: 12px;
    white-space: nowrap;
  }
`
const LegendLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`
const LegendDot = styled.i<{ $color: string }>`
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: ${radii.round};
  background: ${({ $color }) => $color};
`
const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th,
  td {
    padding: 9px;
    border-bottom: 1px solid ${colors.border};
    text-align: left;
  }
  th {
    color: ${colors.muted};
  }
`
