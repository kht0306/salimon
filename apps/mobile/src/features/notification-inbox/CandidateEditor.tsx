import styled from "@emotion/native"
import { formatKrw, getCategoryLabel } from "@salimon/domain"
import type { LocalSmsCandidate, PaymentMethod } from "@salimon/types"
import { observer } from "mobx-react-lite"
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { normalizeAmountInput } from "../transactions/transactionDraft"
import {
  TransactionOptionPickerModal,
  type TransactionOption,
} from "../transactions/TransactionOptionPickerModal"
import {
  createCandidateRegistrationDraft,
  resetCandidateDraftForLedger,
  validateCandidateRegistrationDraft,
  type CandidateRegistrationDraft,
} from "./candidateRegistration"
import { notificationAppName } from "./notificationInbox"

interface CandidateEditorProps {
  candidate: LocalSmsCandidate
  onClose: () => void
  onDefer: () => void
  onExclude: () => void
}

type PickerKind = "category" | "ledger" | "payment"

const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined
const safeAreaEdges = ["top", "bottom"] as const

export const CandidateEditor = observer(function CandidateEditor({
  candidate,
  onClose,
  onDefer,
  onExclude,
}: CandidateEditorProps) {
  const store = useMobileAppStore()
  const [draft, setDraft] = useState<CandidateRegistrationDraft>(() =>
    createCandidateRegistrationDraft(candidate, {
      categories: store.financeData.categories,
      ledgers: store.selectableLedgers,
      paymentMethods: store.financeData.paymentMethods,
    }),
  )
  const [formError, setFormError] = useState<string>()
  const [picker, setPicker] = useState<PickerKind>()
  const savingRef = useRef(false)
  const isSaving = store.notificationRegistrationState === "saving"
  const isPending = candidate.status === "registration_pending"
  const ledgers = store.selectableLedgers
  const categories = store.financeData.categories
    .filter(
      (category) =>
        category.ledgerId === draft.ledgerId &&
        category.usageTypes.includes(candidate.parsed.type) &&
        !category.isArchived,
    )
    .sort((first, second) => first.sortOrder - second.sortOrder)
  const paymentMethods = store.financeData.paymentMethods
    .filter(
      (method) =>
        method.ledgerId === draft.ledgerId &&
        method.isActive &&
        !method.isDeleted,
    )
    .sort(
      (first, second) =>
        Number(second.isPrimary) - Number(first.isPrimary) ||
        first.name.localeCompare(second.name, "ko-KR"),
    )
  const selectedLedger = ledgers.find((ledger) => ledger.id === draft.ledgerId)
  const selectedCategory = categories.find(
    (category) => category.id === draft.categoryId,
  )
  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.id === draft.paymentMethodId,
  )
  const amount = Number(draft.amount)
  const amountPreview =
    Number.isSafeInteger(amount) && amount > 0
      ? formatKrw(amount)
      : "금액 미입력"

  useEffect(() => {
    store.clearNotificationRegistrationError()
  }, [store])

  function updateDraft(nextDraft: CandidateRegistrationDraft): void {
    setDraft(nextDraft)
    setFormError(undefined)
    store.clearNotificationRegistrationError()
  }

  function selectLedger(ledgerId: string): void {
    updateDraft(
      resetCandidateDraftForLedger(draft, candidate, ledgerId, {
        categories: store.financeData.categories,
        paymentMethods: store.financeData.paymentMethods,
      }),
    )
  }

  function requestRegistration(): void {
    const validation = validateCandidateRegistrationDraft(draft, candidate, {
      authUserId: store.authUser?.id ?? "",
      canWriteData:
        store.dataStatus !== "stale" && store.dataStatus !== "error",
      categories: store.financeData.categories,
      ledgers,
      members: store.financeData.members,
      paymentMethods: store.financeData.paymentMethods,
    })
    if (!validation.valid) {
      setFormError(validation.message)
      return
    }

    Alert.alert(
      isPending ? "등록을 다시 시도할까요?" : "거래로 등록할까요?",
      `${selectedLedger?.name ?? "선택한 가계부"}에 ${amountPreview} ${transactionTypeLabel(candidate.parsed.type)}을(를) 등록합니다.`,
      [
        { text: "취소", style: "cancel" },
        { text: "등록", onPress: () => void persistRegistration() },
      ],
    )
  }

  async function persistRegistration(): Promise<void> {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const result = await store.registerNotificationCandidate(draft)
      if (result.status === "saved") {
        Alert.alert(
          "거래 등록 완료",
          "알림 원문과 후보는 기기에서 삭제했습니다.",
          [{ text: "확인", onPress: onClose }],
        )
      } else if (result.status === "already_registered") {
        Alert.alert(
          "이미 등록된 거래예요",
          "중복 거래는 만들지 않고 기기의 후보만 정리했습니다.",
          [{ text: "확인", onPress: onClose }],
        )
      } else if (result.status === "pending") {
        Alert.alert(
          "등록 대기로 보관했어요",
          store.notificationRegistrationErrorMessage ??
            "연결 상태를 확인한 뒤 후보함에서 다시 등록해 주세요.",
          [{ text: "확인", onPress: onClose }],
        )
      }
    } finally {
      savingRef.current = false
    }
  }

  function renderPicker(): React.ReactNode {
    if (picker === "ledger") {
      const options: TransactionOption[] = ledgers.map((ledger) => ({
        description:
          ledger.role === "viewer" ? "조회 전용 · 등록 불가" : "거래 등록 가능",
        id: ledger.id,
        label: ledger.name,
      }))
      return (
        <TransactionOptionPickerModal
          emptyMessage="등록할 수 있는 가계부가 없습니다."
          options={options}
          selectedId={draft.ledgerId}
          title="가계부 선택"
          onClose={() => setPicker(undefined)}
          onSelect={selectLedger}
        />
      )
    }
    if (picker === "category") {
      const options: TransactionOption[] = categories.map((category) => ({
        color: category.color,
        id: category.id,
        label: getCategoryLabel(categories, category.id),
      }))
      return (
        <TransactionOptionPickerModal
          emptyMessage="사용할 카테고리가 없습니다. 웹에서 먼저 설정해 주세요."
          options={options}
          selectedId={draft.categoryId}
          title="카테고리 선택"
          onClose={() => setPicker(undefined)}
          onSelect={(categoryId) => updateDraft({ ...draft, categoryId })}
        />
      )
    }
    if (picker === "payment") {
      const options: TransactionOption[] = paymentMethods.map((method) => ({
        description: method.isPrimary ? "주 결제수단" : undefined,
        id: method.id,
        label: paymentMethodLabel(method),
      }))
      return (
        <TransactionOptionPickerModal
          clearLabel="현금 · 결제수단 없음"
          emptyMessage="연결된 결제수단이 없습니다."
          options={options}
          selectedId={draft.paymentMethodId}
          title="결제수단 선택"
          onClose={() => setPicker(undefined)}
          onSelect={(paymentMethodId) =>
            updateDraft({ ...draft, paymentMethodId })
          }
        />
      )
    }
    return null
  }

  return (
    <Modal
      animationType="slide"
      visible
      onRequestClose={() => {
        if (!isSaving) onClose()
      }}
    >
      <Page
        accessibilityViewIsModal
        edges={safeAreaEdges}
        importantForAccessibility="yes"
        onAccessibilityEscape={isSaving ? undefined : onClose}
      >
        <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Content>
              <TopBar>
                <TopBarButton
                  accessibilityLabel="후보 편집 닫기"
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={onClose}
                >
                  <TopBarLabel>닫기</TopBarLabel>
                </TopBarButton>
                <ScreenLabel>알림 후보 검토</ScreenLabel>
                <TopBarSpacer />
              </TopBar>

              <Intro>
                <Eyebrow>{notificationAppName(candidate.sourceApp)}</Eyebrow>
                <IntroTitle accessibilityRole="header">
                  거래 내용을 확인해 주세요.
                </IntroTitle>
                <IntroDescription>
                  저장 성공 후에만 기기의 암호화 원문과 후보를 삭제합니다.
                </IntroDescription>
              </Intro>

              {isPending ? (
                <PendingNotice>
                  이전 등록 결과를 확인하지 못했습니다. 중복 방지를 위해
                  저장했던 내용은 잠겨 있으며 동일한 내용으로만 다시 시도합니다.
                </PendingNotice>
              ) : null}
              {formError || store.notificationRegistrationErrorMessage ? (
                <ErrorNotice accessibilityLiveRegion="assertive">
                  {formError ?? store.notificationRegistrationErrorMessage}
                </ErrorNotice>
              ) : null}

              <Section>
                <SectionTitle>등록 위치</SectionTitle>
                <SelectionField
                  label="가계부 *"
                  placeholder="가계부를 선택해 주세요."
                  value={selectedLedger?.name}
                  disabled={isPending}
                  onPress={() => setPicker("ledger")}
                />
              </Section>

              <Section>
                <SectionTitle>금액과 일시</SectionTitle>
                <Field>
                  <FieldLabel>금액 *</FieldLabel>
                  <AmountInput
                    accessibilityLabel="후보 거래 금액"
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={mobileTheme.colors.subtle}
                    value={draft.amount}
                    editable={!isPending}
                    onChangeText={(value) =>
                      updateDraft({
                        ...draft,
                        amount: normalizeAmountInput(value),
                      })
                    }
                  />
                  <AmountPreview>{amountPreview}</AmountPreview>
                </Field>
                <DateTimeRow>
                  <DateTimeField>
                    <FieldLabel>날짜 *</FieldLabel>
                    <Input
                      accessibilityLabel="후보 거래 날짜"
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={mobileTheme.colors.subtle}
                      value={draft.date}
                      editable={!isPending}
                      onChangeText={(date) => updateDraft({ ...draft, date })}
                    />
                  </DateTimeField>
                  <DateTimeField>
                    <FieldLabel>시간 *</FieldLabel>
                    <Input
                      accessibilityLabel="후보 거래 시간"
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      placeholder="HH:mm"
                      placeholderTextColor={mobileTheme.colors.subtle}
                      value={draft.time}
                      editable={!isPending}
                      onChangeText={(time) => updateDraft({ ...draft, time })}
                    />
                  </DateTimeField>
                </DateTimeRow>
              </Section>

              <Section>
                <SectionTitle>분류</SectionTitle>
                <SelectionField
                  label="카테고리 *"
                  placeholder="카테고리를 선택해 주세요."
                  value={
                    selectedCategory
                      ? getCategoryLabel(categories, selectedCategory.id)
                      : undefined
                  }
                  disabled={isPending}
                  onPress={() => setPicker("category")}
                />
                {candidate.parsed.type !== "income" ? (
                  <SelectionField
                    label="결제수단"
                    placeholder="현금 · 결제수단 없음"
                    value={
                      selectedPaymentMethod
                        ? paymentMethodLabel(selectedPaymentMethod)
                        : undefined
                    }
                    disabled={isPending}
                    onPress={() => setPicker("payment")}
                  />
                ) : null}
              </Section>

              <Section>
                <SectionTitle>거래 내용</SectionTitle>
                <Field>
                  <FieldLabel>가맹점</FieldLabel>
                  <Input
                    accessibilityLabel="후보 거래 가맹점"
                    placeholder="예: 동네마트"
                    placeholderTextColor={mobileTheme.colors.subtle}
                    value={draft.merchantName}
                    editable={!isPending}
                    onChangeText={(merchantName) =>
                      updateDraft({ ...draft, merchantName })
                    }
                  />
                </Field>
              </Section>

              <MaskedCard>
                <FieldLabel>마스킹된 알림 내용</FieldLabel>
                <MaskedText selectable>{candidate.maskedMessage}</MaskedText>
              </MaskedCard>

              <Actions>
                <AppButton
                  disabled={isSaving}
                  label={
                    isSaving
                      ? "서버에 확인 중..."
                      : isPending
                        ? "거래 등록 다시 시도"
                        : "거래 등록"
                  }
                  tone="primary"
                  onPress={requestRegistration}
                />
                {!isPending ? (
                  <AppButton
                    disabled={isSaving}
                    label="나중에 검토"
                    onPress={onDefer}
                  />
                ) : null}
                <DangerButton
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={onExclude}
                >
                  <DangerLabel>후보 제외 및 원문 삭제</DangerLabel>
                </DangerButton>
                <SubmitHint>
                  네트워크가 끊기면 수정 내용을 기기 암호화 저장소에 등록 대기로
                  보관합니다. 서버에는 알림 원문이나 마스킹 문구를 보내지
                  않습니다.
                </SubmitHint>
              </Actions>
            </Content>
          </ScrollView>
        </KeyboardAvoidingView>
        {renderPicker()}
      </Page>
    </Modal>
  )
})

interface SelectionFieldProps {
  disabled?: boolean
  label: string
  placeholder: string
  value?: string
  onPress: () => void
}

function SelectionField({
  disabled = false,
  label,
  placeholder,
  value,
  onPress,
}: SelectionFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SelectionButton
        accessibilityHint={
          disabled
            ? "등록 대기 중에는 변경할 수 없습니다."
            : "선택 목록을 엽니다."
        }
        accessibilityLabel={`${label}, ${value ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <SelectionValue $placeholder={!value} numberOfLines={2}>
          {value ?? placeholder}
        </SelectionValue>
        <SelectionAction>{disabled ? "변경 불가" : "선택"}</SelectionAction>
      </SelectionButton>
    </Field>
  )
}

function paymentMethodLabel(method: PaymentMethod): string {
  const issuer = method.issuer ? `${method.issuer} · ` : ""
  const last4 = method.last4 ? ` (${method.last4})` : ""
  return `${issuer}${method.name}${last4}`
}

function transactionTypeLabel(
  type: LocalSmsCandidate["parsed"]["type"],
): string {
  if (type === "income") return "수입"
  if (type === "saving") return "저축"
  return "지출"
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: mobileTheme.spacing[8] },
})

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
})
const Content = styled.View({
  width: "100%",
  maxWidth: 720,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})
const TopBar = styled.View({
  minHeight: 44,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})
const TopBarButton = styled.Pressable({
  minWidth: 56,
  minHeight: 40,
  justifyContent: "center",
})
const TopBarLabel = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "800",
})
const ScreenLabel = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 15,
  fontWeight: "900",
})
const TopBarSpacer = styled.View({ width: 56 })
const Intro = styled.View({ gap: mobileTheme.spacing[1] })
const Eyebrow = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})
const IntroTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 24,
  fontWeight: "900",
  lineHeight: 31,
})
const IntroDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  lineHeight: 18,
})
const PendingNotice = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.amberSoft,
  color: mobileTheme.colors.amber,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
})
const ErrorNotice = styled.Text({
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 12,
  lineHeight: 19,
  padding: mobileTheme.spacing[3],
})
const Section = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})
const SectionTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 16,
  fontWeight: "900",
})
const Field = styled.View({ gap: mobileTheme.spacing[2] })
const FieldLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "800",
})
const Input = styled.TextInput({
  minHeight: 48,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panelSubtle,
  color: mobileTheme.colors.ink,
  fontSize: 15,
  paddingHorizontal: mobileTheme.spacing[3],
})
const AmountInput = styled(Input)({
  minHeight: 60,
  fontSize: 28,
  fontWeight: "900",
})
const AmountPreview = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 12,
  fontWeight: "800",
})
const DateTimeRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[3],
})
const DateTimeField = styled.View({ flex: 1, gap: mobileTheme.spacing[2] })
const SelectionButton = styled.Pressable(({ disabled }) => ({
  minHeight: 52,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panelSubtle,
  paddingHorizontal: mobileTheme.spacing[3],
  opacity: disabled ? 0.62 : 1,
}))
const SelectionValue = styled.Text<{ $placeholder: boolean }>(
  ({ $placeholder }) => ({
    minWidth: 0,
    flex: 1,
    color: $placeholder ? mobileTheme.colors.subtle : mobileTheme.colors.ink,
    fontSize: 14,
    fontWeight: $placeholder ? "500" : "700",
  }),
)
const SelectionAction = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})
const MaskedCard = styled.View({
  gap: mobileTheme.spacing[2],
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panelSubtle,
  padding: mobileTheme.spacing[4],
})
const MaskedText = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 12,
  lineHeight: 19,
})
const Actions = styled.View({ gap: mobileTheme.spacing[2] })
const DangerButton = styled.Pressable(({ disabled }) => ({
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: mobileTheme.colors.coral,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  opacity: disabled ? 0.45 : 1,
}))
const DangerLabel = styled.Text({
  color: mobileTheme.colors.coral,
  fontSize: 14,
  fontWeight: "800",
})
const SubmitHint = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  textAlign: "center",
})
