import { formatKrw } from "@salimon/domain"
import { observer } from "mobx-react-lite"
import { Alert } from "react-native"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import {
  ErrorText,
  InlineRow,
  ItemCard,
  ItemMeta,
  ItemTitle,
  ManagementScaffold,
  SectionCard,
  SectionDescription,
  SectionTitle,
  TextButton,
  TextButtonLabel,
} from "./ManagementUI"

export const RecurringRuleManagementScreen = observer(
  function RecurringRuleManagementScreen() {
    const store = useMobileAppStore()
    const rules = store.financeData.recurringRules.filter(
      (rule) =>
        rule.ledgerId === store.selectedLedgerId &&
        rule.type === "fixed" &&
        (!rule.inactiveFromMonth ||
          rule.inactiveFromMonth > store.selectedMonth),
    )
    const busy = store.transactionMutationState !== "idle"
    const readOnly = store.currentLedger?.role === "viewer"

    function confirmEnd(ruleId: string, timing: "current" | "next"): void {
      const current = timing === "current"
      Alert.alert(
        current ? "이번 달부터 종료할까요?" : "다음 달부터 종료할까요?",
        current
          ? "이번 달에 생성된 거래와 이후 반복 거래를 종료합니다."
          : "이번 달 거래는 유지하고 다음 달부터 반복 생성을 종료합니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "종료",
            style: current ? "destructive" : "default",
            onPress: () => void store.endFixedRule(ruleId, timing),
          },
        ],
      )
    }

    return (
      <ManagementScaffold
        description="현재 가계부에서 매월 반복되는 고정 수입·지출·저축을 종료 시점별로 관리합니다."
        title="고정 거래 관리"
      >
        {store.transactionMutationErrorMessage ? (
          <ErrorText accessibilityRole="alert">
            {store.transactionMutationErrorMessage}
          </ErrorText>
        ) : null}
        <SectionCard>
          <SectionTitle>{store.selectedMonth} 활성 규칙</SectionTitle>
          <SectionDescription>
            조회자는 규칙을 확인할 수만 있습니다. 종료한 규칙은 선택한 시점부터
            새 거래가 생성되지 않습니다.
          </SectionDescription>
          {rules.length > 0 ? (
            rules.map((rule) => (
              <ItemCard key={rule.id}>
                <ItemTitle>
                  {rule.merchantName ||
                    rule.memo ||
                    (rule.transactionType === "income"
                      ? "고정 수입"
                      : rule.transactionType === "saving"
                        ? "정기 저축"
                        : "고정 지출")}
                </ItemTitle>
                <ItemMeta>
                  {formatKrw(rule.amount)} · 매월 {rule.dayOfMonth}일 ·{" "}
                  {rule.transactionType === "income"
                    ? "수입"
                    : rule.transactionType === "saving"
                      ? "저축"
                      : "지출"}
                </ItemMeta>
                <InlineRow>
                  <TextButton
                    disabled={busy || readOnly}
                    onPress={() => confirmEnd(rule.id, "next")}
                  >
                    <TextButtonLabel>다음 달부터 종료</TextButtonLabel>
                  </TextButton>
                  <TextButton
                    $danger
                    disabled={busy || readOnly}
                    onPress={() => confirmEnd(rule.id, "current")}
                  >
                    <TextButtonLabel $danger>이번 달부터 종료</TextButtonLabel>
                  </TextButton>
                </InlineRow>
              </ItemCard>
            ))
          ) : (
            <SectionDescription>
              이 달에 활성화된 고정 거래 규칙이 없습니다.
            </SectionDescription>
          )}
        </SectionCard>
      </ManagementScaffold>
    )
  },
)
