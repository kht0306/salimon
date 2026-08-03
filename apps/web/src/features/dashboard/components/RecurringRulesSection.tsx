"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Button } from "../styles"

export const RecurringRulesSection = observer(function RecurringRulesSection() {
  const store = useAppStore()

  return (
    <RecurringSection>
      <strong>고정 거래 관리 ({store.selectedMonth})</strong>
      {store.data.recurringRules
        .filter(
          (rule) =>
            rule.ledgerId === store.selectedLedgerId &&
            rule.type === "fixed" &&
            (!rule.inactiveFromMonth ||
              rule.inactiveFromMonth > store.selectedMonth),
        )
        .map((rule) => (
          <RecurringRow key={rule.id}>
            <span>
              {rule.merchantName ||
                rule.memo ||
                (rule.transactionType === "income"
                  ? "고정수입"
                  : rule.transactionType === "saving"
                    ? "정기저축"
                    : "고정비")}{" "}
              · {rule.amount.toLocaleString("ko-KR")}원 · 매월 {rule.dayOfMonth}
              일
            </span>
            <RecurringActions>
              <Button onClick={() => void store.endFixedRule(rule.id, "next")}>
                다음 달부터 종료
              </Button>
              <Button
                $variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "이번 달 거래와 이후 반복 거래를 모두 종료할까요?",
                    )
                  ) {
                    void store.endFixedRule(rule.id, "current")
                  }
                }}
              >
                이번 달부터 종료
              </Button>
            </RecurringActions>
          </RecurringRow>
        ))}
    </RecurringSection>
  )
})

const RecurringSection = styled.div`
  display: grid;
  gap: 10px;
  padding: 18px;
  border-top: 1px solid ${colors.border};
`

const RecurringRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: ${colors.muted};
  font-size: 13px;
`

const RecurringActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
`
