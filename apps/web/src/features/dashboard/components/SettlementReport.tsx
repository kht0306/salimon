"use client"

import styled from "@emotion/styled"
import {
  formatKrw,
  getCategoryLabel,
  getDescendantCategoryIds,
  transactionAmountForCategoryIds,
} from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import {
  getSettlementActorName,
  getSettlementCategoryName,
  type SettlementChart,
} from "./settlementPresentation"

interface SettlementReportProps {
  chart: SettlementChart
}

export const SettlementReport = observer(function SettlementReport({
  chart,
}: SettlementReportProps) {
  const store = useAppStore()
  const confirmedTransactions = store.monthTransactions.filter(
    (item) => item.status === "confirmed",
  )
  const excludedTransactions = store.monthTransactions.filter(
    (item) => item.status === "excluded",
  )
  const categoryRows = store.expenseCategories
    .filter((category) => !category.parentCategoryId)
    .map((category) => {
      const categoryIds = getDescendantCategoryIds(
        store.data.categories.filter(
          (item) => item.ledgerId === store.selectedLedgerId,
        ),
        category.id,
      )
      const spent = confirmedTransactions
        .filter((item) => item.type === "expense")
        .reduce(
          (sum, item) =>
            sum +
            transactionAmountForCategoryIds(
              item,
              store.data.transactionSplits,
              categoryIds,
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
  const budgetRows = store.selectedMonthBudgets.map(
    ({ category, amount, spent }) => ({
      category,
      budget: amount,
      spent,
    }),
  )
  const max = Math.max(1, ...categoryRows.map((item) => item.spent))
  const pieRows = categoryRows.filter((item) => item.spent > 0)

  return (
    <>
      <Section>
        <h3>{store.selectedMonth} 카테고리별 지출</h3>
        {chart === "bar" ? (
          <Bars>
            {categoryRows.map(({ category, spent }) => (
              <BarRow key={category.id}>
                <span>
                  {getCategoryLabel(store.data.categories, category.id)}
                </span>
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
                    {getCategoryLabel(store.data.categories, category.id)}
                  </LegendLabel>
                  <strong>{formatKrw(spent)}</strong>
                </PieLegendItem>
              ))}
            </PieLegend>
          </PieChartLayout>
        )}
        {categoryRows.length === 0 ? (
          <Empty>확정 지출 또는 예산이 없습니다.</Empty>
        ) : null}
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
              {budgetRows.map(({ category, budget, spent }) => (
                <tr key={category.id}>
                  <td>
                    {getCategoryLabel(store.data.categories, category.id)}
                  </td>
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
          거래내역 {store.monthTransactions.length}건 · 정산 제외{" "}
          {excludedTransactions.length}건
        </h3>
        <TransactionCards>
          {store.monthTransactions.map((item) => (
            <TransactionCard
              key={item.id}
              $excluded={item.status === "excluded"}
            >
              <div>
                <strong>{item.merchantName || item.memo || "거래"}</strong>
                <span>
                  {getSettlementCategoryName(
                    store.data.categories,
                    item,
                    store.data.transactionSplits,
                  )}{" "}
                  · {getSettlementActorName(store.currentMembers, item)}
                </span>
              </div>
              <div>
                <StatusBadge $excluded={item.status === "excluded"}>
                  {item.status === "excluded" ? "정산 제외" : "정산 포함"}
                </StatusBadge>
                <strong>{formatKrw(item.amount)}</strong>
                <time>
                  {new Date(item.transactionAt).toLocaleString("ko-KR")}
                </time>
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
                  <td>
                    {new Date(item.transactionAt).toLocaleString("ko-KR")}
                  </td>
                  <td>
                    <StatusBadge $excluded={item.status === "excluded"}>
                      {item.status === "excluded" ? "제외" : "포함"}
                    </StatusBadge>
                  </td>
                  <td>
                    {getSettlementCategoryName(
                      store.data.categories,
                      item,
                      store.data.transactionSplits,
                    )}
                  </td>
                  <td>
                    {item.merchantName || item.memo || "거래"}
                    {item.recurringType === "installment"
                      ? ` (${item.installmentNumber}/${item.installmentTotal}개월)`
                      : ""}
                  </td>
                  <td>{getSettlementActorName(store.currentMembers, item)}</td>
                  <td>{formatKrw(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableScroll>
      </Section>
    </>
  )
})

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
  grid-template-columns: 90px minmax(80px, 1fr) 100px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  strong {
    text-align: right;
  }
  @media (max-width: 520px) {
    grid-template-columns: minmax(65px, auto) 1fr;
    strong {
      grid-column: 2;
      grid-row: 2;
    }
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
    background: ${colors.panel};
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
const TableScroll = styled.div`
  overflow-x: auto;
`
const DataTable = styled.table`
  width: 100%;
  min-width: 520px;
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
  tr[data-excluded="true"] {
    color: ${colors.muted};
    background: ${colors.panelSubtle};
  }
  td[data-negative="true"] {
    color: ${colors.coral};
    font-weight: 700;
  }
  &.transaction-table th:first-of-type,
  &.transaction-table td:first-of-type {
    width: 1%;
    white-space: nowrap;
  }
  &.transaction-table th:nth-of-type(4),
  &.transaction-table td:nth-of-type(4) {
    width: 36%;
  }
  @media print {
    &.transaction-table th:nth-of-type(4),
    &.transaction-table td:nth-of-type(4) {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    &.transaction-table th:nth-of-type(5),
    &.transaction-table td:nth-of-type(5) {
      width: 1%;
      white-space: nowrap;
    }
  }
  @media (max-width: 640px) {
    &.desktop-table {
      display: none;
    }
  }
`
const StatusBadge = styled.span<{ $excluded: boolean }>`
  display: inline-flex;
  border-radius: ${radii.round};
  background: ${({ $excluded }) =>
    $excluded ? colors.panelSubtle : colors.tealSoft};
  color: ${({ $excluded }) => ($excluded ? colors.muted : colors.teal)};
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
`
const TransactionCards = styled.div`
  display: none;
  gap: 8px;
  @media (max-width: 640px) {
    display: grid;
  }
`
const TransactionCard = styled.article<{ $excluded: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${({ $excluded }) =>
    $excluded ? colors.panelSubtle : colors.panel};
  padding: 11px;
  > div {
    display: grid;
    gap: 4px;
  }
  > div:last-child {
    justify-items: end;
  }
  span,
  time {
    color: ${colors.muted};
    font-size: 10px;
  }
  strong {
    font-size: 12px;
  }
`
const Empty = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 12px;
`
