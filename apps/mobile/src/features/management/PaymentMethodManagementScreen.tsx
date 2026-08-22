import type { PaymentInstrument } from "@salimon/types"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { Alert, Switch } from "react-native"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import type {
  MobileAccountInput,
  MobileCardInput,
} from "../../stores/mobileAppStore"
import { mobileTheme } from "../../theme"
import {
  ChoiceButton,
  ChoiceLabel,
  ErrorText,
  Field,
  FieldLabel,
  InlineRow,
  Input,
  ItemCard,
  ItemMeta,
  ItemTitle,
  ManagementScaffold,
  NoticeText,
  SectionCard,
  SectionDescription,
  SectionHeading,
  SectionTitle,
  TextButton,
  TextButtonLabel,
} from "./ManagementUI"

type InstrumentMode = "card" | "bank"

const initialCard: MobileCardInput = {
  billingPeriodEndDay: 14,
  billingPeriodEndMonthOffset: 0,
  isDebit: false,
  issuer: "",
  name: "",
  paymentDay: 25,
}

const initialAccount: MobileAccountInput = { bank: "", name: "" }

export const PaymentMethodManagementScreen = observer(
  function PaymentMethodManagementScreen() {
    const store = useMobileAppStore()
    const [mode, setMode] = useState<InstrumentMode>("card")
    const [editingId, setEditingId] = useState<string>()
    const [card, setCard] = useState<MobileCardInput>(initialCard)
    const [account, setAccount] = useState<MobileAccountInput>(initialAccount)
    const [connectedIds, setConnectedIds] = useState<string[]>([])
    const [visibleIds, setVisibleIds] = useState<string[]>([])
    const [primaryId, setPrimaryId] = useState("")
    const busy = store.managementMutationState !== "idle"
    const activeInstruments = store.myPaymentInstruments.filter(
      (item) => item.isActive,
    )

    useEffect(() => {
      store.clearManagementFeedback()
    }, [store])

    useEffect(() => {
      const ownedLinks = store.financeData.paymentMethods.filter(
        (method) =>
          method.ledgerId === store.selectedLedgerId &&
          method.ownerUserId === store.authUser?.id &&
          !method.isDeleted &&
          method.isActive,
      )
      setConnectedIds(ownedLinks.map((method) => method.instrumentId))
      setVisibleIds(
        ownedLinks
          .filter((method) => method.visibility === "ledger")
          .map((method) => method.instrumentId),
      )
      setPrimaryId(
        ownedLinks.find((method) => method.type === "card" && method.isPrimary)
          ?.instrumentId ?? "",
      )
    }, [
      store.authUser?.id,
      store.financeData.paymentMethods,
      store.selectedLedgerId,
    ])

    function resetForm(nextMode = mode): void {
      setMode(nextMode)
      setEditingId(undefined)
      setCard(initialCard)
      setAccount(initialAccount)
    }

    function startEditing(instrument: PaymentInstrument): void {
      setEditingId(instrument.id)
      if (instrument.type === "card") {
        setMode("card")
        setCard({
          billingPeriodEndDay: instrument.billingPeriodEndDay ?? 14,
          billingPeriodEndMonthOffset:
            instrument.billingPeriodEndMonthOffset ?? 0,
          isDebit: Boolean(instrument.isDebit),
          issuer: instrument.issuer ?? "",
          last4: instrument.last4,
          name: instrument.name,
          paymentDay: instrument.paymentDay ?? 25,
        })
      } else {
        setMode("bank")
        setAccount({
          bank: instrument.issuer ?? "",
          last4: instrument.last4,
          name: instrument.name,
        })
      }
    }

    async function saveInstrument(): Promise<void> {
      const saved =
        mode === "card"
          ? editingId
            ? await store.updateCard(editingId, card)
            : await store.createCard(card)
          : editingId
            ? await store.updateAccount(editingId, account)
            : await store.createAccount(account)
      if (saved) resetForm(mode)
    }

    function toggleConnected(instrumentId: string): void {
      const selected = connectedIds.includes(instrumentId)
      const nextIds = selected
        ? connectedIds.filter((id) => id !== instrumentId)
        : [...connectedIds, instrumentId]
      setConnectedIds(nextIds)
      if (selected) {
        setVisibleIds((ids) => ids.filter((id) => id !== instrumentId))
        if (primaryId === instrumentId) setPrimaryId("")
      }
    }

    function confirmDelete(instrument: PaymentInstrument): void {
      Alert.alert(
        `${instrument.type === "card" ? "카드" : "계좌"}를 삭제할까요?`,
        "모든 가계부 연결은 해제되지만 기존 거래 기록은 유지됩니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: () =>
              void (instrument.type === "card"
                ? store.deleteCard(instrument.id)
                : store.deleteAccount(instrument.id)),
          },
        ],
      )
    }

    return (
      <ManagementScaffold
        description="내 카드·계좌를 등록하고 현재 가계부에 연결합니다. 전체 번호와 잔액은 저장하지 않습니다."
        title="카드·계좌"
      >
        {store.managementErrorMessage ? (
          <ErrorText accessibilityRole="alert">
            {store.managementErrorMessage}
          </ErrorText>
        ) : null}
        {store.managementNoticeMessage ? (
          <NoticeText accessibilityLiveRegion="polite">
            {store.managementNoticeMessage}
          </NoticeText>
        ) : null}

        <SectionCard>
          <SectionHeading>
            <SectionTitle>
              {editingId ? "결제수단 수정" : "내 결제수단 등록"}
            </SectionTitle>
            {editingId ? (
              <TextButton disabled={busy} onPress={() => resetForm(mode)}>
                <TextButtonLabel>새로 입력</TextButtonLabel>
              </TextButton>
            ) : null}
          </SectionHeading>
          <InlineRow>
            {(["card", "bank"] as const).map((value) => (
              <ChoiceButton
                key={value}
                $selected={mode === value}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === value }}
                onPress={() => resetForm(value)}
              >
                <ChoiceLabel $selected={mode === value}>
                  {value === "card" ? "카드" : "계좌"}
                </ChoiceLabel>
              </ChoiceButton>
            ))}
          </InlineRow>

          {mode === "card" ? (
            <>
              <InlineRow>
                <Field style={{ flex: 1, minWidth: 150 }}>
                  <FieldLabel>카드사 *</FieldLabel>
                  <Input
                    accessibilityLabel="카드사"
                    placeholder="예: 롯데카드"
                    value={card.issuer}
                    onChangeText={(issuer) => setCard({ ...card, issuer })}
                  />
                </Field>
                <Field style={{ flex: 1, minWidth: 150 }}>
                  <FieldLabel>별칭 *</FieldLabel>
                  <Input
                    accessibilityLabel="카드 별칭"
                    placeholder="예: 생활비 카드"
                    value={card.name}
                    onChangeText={(name) => setCard({ ...card, name })}
                  />
                </Field>
              </InlineRow>
              <Field>
                <FieldLabel>끝 4자리</FieldLabel>
                <Input
                  accessibilityLabel="카드 끝 4자리"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={card.last4 ?? ""}
                  onChangeText={(last4) =>
                    setCard({ ...card, last4: last4.replace(/\D/g, "") })
                  }
                />
              </Field>
              <InlineRow>
                <NumericField
                  label="결제일"
                  value={card.paymentDay}
                  onChange={(paymentDay) => setCard({ ...card, paymentDay })}
                />
                <NumericField
                  label="이용기간 종료일"
                  value={card.billingPeriodEndDay}
                  onChange={(billingPeriodEndDay) =>
                    setCard({ ...card, billingPeriodEndDay })
                  }
                />
              </InlineRow>
              <Field>
                <FieldLabel>이용기간 종료월</FieldLabel>
                <InlineRow>
                  {([-1, 0] as const).map((offset) => (
                    <ChoiceButton
                      key={offset}
                      $selected={card.billingPeriodEndMonthOffset === offset}
                      onPress={() =>
                        setCard({
                          ...card,
                          billingPeriodEndMonthOffset: offset,
                        })
                      }
                    >
                      <ChoiceLabel
                        $selected={card.billingPeriodEndMonthOffset === offset}
                      >
                        {offset === -1 ? "전월" : "당월"}
                      </ChoiceLabel>
                    </ChoiceButton>
                  ))}
                </InlineRow>
              </Field>
              <SectionHeading>
                <FieldLabel>체크카드</FieldLabel>
                <Switch
                  accessibilityLabel="체크카드 여부"
                  trackColor={{
                    false: mobileTheme.colors.borderStrong,
                    true: mobileTheme.colors.teal,
                  }}
                  value={card.isDebit}
                  onValueChange={(isDebit) => setCard({ ...card, isDebit })}
                />
              </SectionHeading>
            </>
          ) : (
            <>
              <InlineRow>
                <Field style={{ flex: 1, minWidth: 150 }}>
                  <FieldLabel>은행 *</FieldLabel>
                  <Input
                    accessibilityLabel="은행"
                    placeholder="예: 카카오뱅크"
                    value={account.bank}
                    onChangeText={(bank) => setAccount({ ...account, bank })}
                  />
                </Field>
                <Field style={{ flex: 1, minWidth: 150 }}>
                  <FieldLabel>별칭 *</FieldLabel>
                  <Input
                    accessibilityLabel="계좌 별칭"
                    placeholder="예: 비상금 통장"
                    value={account.name}
                    onChangeText={(name) => setAccount({ ...account, name })}
                  />
                </Field>
              </InlineRow>
              <Field>
                <FieldLabel>끝 4자리</FieldLabel>
                <Input
                  accessibilityLabel="계좌 끝 4자리"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={account.last4 ?? ""}
                  onChangeText={(last4) =>
                    setAccount({
                      ...account,
                      last4: last4.replace(/\D/g, ""),
                    })
                  }
                />
              </Field>
            </>
          )}
          <AppButton
            disabled={busy}
            label={busy ? "저장 중..." : editingId ? "수정 저장" : "등록"}
            tone="primary"
            onPress={() => void saveInstrument()}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>내 카드·계좌</SectionTitle>
          {store.myPaymentInstruments.length === 0 ? (
            <SectionDescription>
              등록된 카드나 계좌가 없습니다.
            </SectionDescription>
          ) : null}
          {store.myPaymentInstruments.map((instrument) => (
            <ItemCard key={instrument.id}>
              <ItemTitle>
                {instrument.issuer ? `${instrument.issuer} · ` : ""}
                {instrument.name}
              </ItemTitle>
              <ItemMeta>
                {instrument.type === "card" ? "카드" : "계좌"}
                {instrument.last4 ? ` · 끝 ${instrument.last4}` : ""}
                {!instrument.isActive ? " · 비활성" : ""}
              </ItemMeta>
              <InlineRow>
                <TextButton
                  disabled={busy}
                  onPress={() => startEditing(instrument)}
                >
                  <TextButtonLabel>수정</TextButtonLabel>
                </TextButton>
                <TextButton
                  disabled={busy}
                  onPress={() =>
                    void (instrument.type === "card"
                      ? store.setCardActive(instrument.id, !instrument.isActive)
                      : store.setAccountActive(
                          instrument.id,
                          !instrument.isActive,
                        ))
                  }
                >
                  <TextButtonLabel>
                    {instrument.isActive ? "비활성" : "활성화"}
                  </TextButtonLabel>
                </TextButton>
                <TextButton
                  $danger
                  disabled={busy}
                  onPress={() => confirmDelete(instrument)}
                >
                  <TextButtonLabel $danger>삭제</TextButtonLabel>
                </TextButton>
              </InlineRow>
            </ItemCard>
          ))}
        </SectionCard>

        <SectionCard>
          <SectionTitle>현재 가계부 연결</SectionTitle>
          <SectionDescription>
            {store.currentLedger?.type === "shared"
              ? "공동 공개 여부를 선택할 수 있습니다. 다른 멤버의 비공개 결제수단은 표시되지 않습니다."
              : "현재 가계부에서 사용할 카드와 계좌를 선택합니다."}
          </SectionDescription>
          {activeInstruments.map((instrument) => {
            const connected = connectedIds.includes(instrument.id)
            const visible = visibleIds.includes(instrument.id)
            const primary = primaryId === instrument.id
            return (
              <ItemCard key={`link-${instrument.id}`}>
                <ItemTitle>{instrument.name}</ItemTitle>
                <InlineRow>
                  <ChoiceButton
                    $selected={connected}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: connected }}
                    onPress={() => toggleConnected(instrument.id)}
                  >
                    <ChoiceLabel $selected={connected}>가계부 연결</ChoiceLabel>
                  </ChoiceButton>
                  {store.currentLedger?.type === "shared" && connected ? (
                    <ChoiceButton
                      $selected={visible}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: visible }}
                      onPress={() =>
                        setVisibleIds((ids) =>
                          visible
                            ? ids.filter((id) => id !== instrument.id)
                            : [...ids, instrument.id],
                        )
                      }
                    >
                      <ChoiceLabel $selected={visible}>공동 공개</ChoiceLabel>
                    </ChoiceButton>
                  ) : null}
                  {instrument.type === "card" && connected ? (
                    <ChoiceButton
                      $selected={primary}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: primary }}
                      onPress={() => setPrimaryId(primary ? "" : instrument.id)}
                    >
                      <ChoiceLabel $selected={primary}>주 카드</ChoiceLabel>
                    </ChoiceButton>
                  ) : null}
                </InlineRow>
              </ItemCard>
            )
          })}
          <AppButton
            disabled={busy || store.currentLedger?.role === "viewer"}
            label={busy ? "연결 저장 중..." : "연결 저장"}
            tone="primary"
            onPress={() =>
              void store.syncCurrentLedgerPaymentMethods(
                connectedIds,
                visibleIds,
                primaryId || undefined,
              )
            }
          />
        </SectionCard>
      </ManagementScaffold>
    )
  },
)

interface NumericFieldProps {
  label: string
  onChange: (value: number) => void
  value: number
}

function NumericField({ label, onChange, value }: NumericFieldProps) {
  return (
    <Field style={{ flex: 1, minWidth: 140 }}>
      <FieldLabel>{label} *</FieldLabel>
      <Input
        accessibilityLabel={label}
        keyboardType="number-pad"
        maxLength={2}
        value={String(value || "")}
        onChangeText={(text) => onChange(Number(text.replace(/\D/g, "")))}
      />
    </Field>
  )
}
