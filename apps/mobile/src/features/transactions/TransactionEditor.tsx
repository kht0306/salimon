import styled from "@emotion/native"
import { formatKrw, getCategoryLabel, toDateKey } from "@salimon/domain"
import type {
  Category,
  LedgerMember,
  PaymentMethod,
  Transaction,
  TransactionType,
} from "@salimon/types"
import { Redirect, router } from "expo-router"
import { observer } from "mobx-react-lite"
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import {
  changeMobileTransactionType,
  createEditingMobileTransactionDraft,
  createNewMobileTransactionDraft,
  isGeneralMobileTransaction,
  normalizeAmountInput,
  validateMobileTransactionDraft,
  type MobileGeneralTransactionInput,
  type MobileTransactionDraft,
} from "./transactionDraft"
import {
  TransactionOptionPickerModal,
  type TransactionOption,
} from "./TransactionOptionPickerModal"

interface TransactionEditorScreenProps {
  transactionId?: string
}

const safeAreaEdges = ["top", "bottom"] as const
const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined

export const TransactionEditorScreen = observer(
  function TransactionEditorScreen({
    transactionId,
  }: TransactionEditorScreenProps) {
    const store = useMobileAppStore()

    if (store.authState === "anonymous") {
      return <Redirect href="/auth/login" />
    }
    if (store.authState !== "authenticated") {
      return <EditorState message="로그인 상태를 확인하고 있어요." />
    }
    if (store.requiresLegalConsent) {
      return <Redirect href="/consent" />
    }
    if (
      (store.dataStatus === "idle" || store.dataStatus === "loading") &&
      store.transactionMutationState === "idle"
    ) {
      return <EditorState message="거래 정보를 준비하고 있어요." />
    }
    if (store.dataStatus === "error") {
      return (
        <EditorState
          actionLabel="다시 불러오기"
          message={store.dataErrorMessage ?? "거래 정보를 불러오지 못했습니다."}
          onAction={() => void store.refreshSelectedMonth()}
        />
      )
    }
    if (!store.canMutateCurrentLedger) {
      return (
        <EditorState
          actionLabel="거래 목록으로 돌아가기"
          message="이 가계부는 조회만 할 수 있어 거래를 변경할 수 없습니다."
          onAction={() => router.replace("/transactions")}
        />
      )
    }

    const transaction = transactionId
      ? store.financeData.transactions.find(
          (item) => item.id === transactionId && !item.deletedAt,
        )
      : undefined
    if (transactionId && !transaction) {
      return (
        <EditorState
          actionLabel="거래 목록으로 돌아가기"
          message="현재 불러온 월에서 수정할 거래를 찾지 못했습니다."
          onAction={() => router.replace("/transactions")}
        />
      )
    }

    const splitCount = transaction
      ? store.financeData.transactionSplits.filter(
          (split) => split.transactionId === transaction.id,
        ).length
      : 0
    if (transaction && !isGeneralMobileTransaction(transaction, splitCount)) {
      return (
        <EditorState
          actionLabel="거래 상세로 돌아가기"
          message="고정·할부·분할 거래는 모바일에서 조회만 할 수 있습니다."
          onAction={() => router.back()}
        />
      )
    }

    const categories = store.financeData.categories.filter(
      (category) => category.ledgerId === store.selectedLedgerId,
    )
    const members = store.financeData.members.filter(
      (member) =>
        member.ledgerId === store.selectedLedgerId &&
        member.status === "active",
    )
    const paymentMethods = store.financeData.paymentMethods.filter(
      (method) => method.ledgerId === store.selectedLedgerId,
    )

    return (
      <TransactionEditorForm
        key={transaction?.id ?? `new-${store.selectedLedgerId}`}
        categories={categories}
        members={members}
        paymentMethods={paymentMethods}
        selectedDate={store.selectedDate}
        transaction={transaction}
      />
    )
  },
)

interface TransactionEditorFormProps {
  categories: Category[]
  members: LedgerMember[]
  paymentMethods: PaymentMethod[]
  selectedDate: string
  transaction?: Transaction
}

type PickerKind = "actor" | "category" | "payment"

const TransactionEditorForm = observer(function TransactionEditorForm({
  categories,
  members,
  paymentMethods,
  selectedDate,
  transaction,
}: TransactionEditorFormProps) {
  const store = useMobileAppStore()
  const [draft, setDraft] = useState<MobileTransactionDraft>(() =>
    transaction
      ? createEditingMobileTransactionDraft(transaction)
      : createNewMobileTransactionDraft({
          actorUserId: store.authUser?.id,
          categories,
          paymentMethods,
          selectedDate,
        }),
  )
  const [formError, setFormError] = useState<string>()
  const [picker, setPicker] = useState<PickerKind>()
  const savingRef = useRef(false)
  const isSaving = store.transactionMutationState === "saving"

  useEffect(() => {
    store.clearTransactionMutationError()
  }, [store])

  const availableCategories = categories
    .filter(
      (category) =>
        category.usageTypes.includes(draft.type) &&
        (!category.isArchived || category.id === transaction?.categoryId),
    )
    .sort((first, second) => first.sortOrder - second.sortOrder)
  const availablePaymentMethods = paymentMethods
    .filter(
      (method) =>
        (method.isActive && !method.isDeleted) ||
        method.id === transaction?.paymentMethodId,
    )
    .filter((method) => draft.type !== "saving" || method.type === "bank")
    .sort(
      (first, second) =>
        Number(second.isPrimary) - Number(first.isPrimary) ||
        first.name.localeCompare(second.name, "ko-KR"),
    )
  const category = categories.find((item) => item.id === draft.categoryId)
  const paymentMethod = paymentMethods.find(
    (item) => item.id === draft.paymentMethodId,
  )
  const actor = members.find((member) => member.userId === draft.actorUserId)
  const amount = Number(draft.amount)
  const amountPreview =
    Number.isSafeInteger(amount) && amount > 0
      ? formatKrw(amount)
      : "금액 미입력"

  function updateDraft(nextDraft: MobileTransactionDraft): void {
    setDraft(nextDraft)
    setFormError(undefined)
    store.clearTransactionMutationError()
  }

  function selectType(type: TransactionType): void {
    updateDraft(
      changeMobileTransactionType(draft, type, categories, paymentMethods),
    )
  }

  function setCurrentDateTime(): void {
    const now = new Date()
    updateDraft({
      ...draft,
      date: toDateKey(now),
      time: `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`,
    })
  }

  function requestSave(): void {
    const validation = validateMobileTransactionDraft(draft, {
      categories,
      editingTransaction: transaction,
      ledgerId: store.selectedLedgerId,
      members,
      paymentMethods,
    })
    if (!validation.valid) {
      setFormError(validation.message)
      return
    }

    Alert.alert(
      transaction ? "거래를 수정할까요?" : "거래를 등록할까요?",
      `${transactionTypeLabel(draft.type)} ${amountPreview}을(를) ${
        transaction ? "수정" : "등록"
      }합니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: transaction ? "수정" : "등록",
          onPress: () => void persistTransaction(validation.input),
        },
      ],
    )
  }

  async function persistTransaction(
    input: MobileGeneralTransactionInput,
  ): Promise<void> {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const result = await store.saveGeneralTransaction(input)
      if (result.status === "saved") {
        router.replace({
          pathname: "/transactions/[id]",
          params: { id: result.transactionId },
        })
      }
    } finally {
      savingRef.current = false
    }
  }

  function renderPicker(): React.ReactNode {
    if (picker === "category") {
      const options: TransactionOption[] = availableCategories.map((item) => ({
        id: item.id,
        label: getCategoryLabel(categories, item.id),
        description: item.isArchived ? "보관된 카테고리" : undefined,
        color: item.color,
      }))
      return (
        <TransactionOptionPickerModal
          emptyMessage="이 거래 유형에 사용할 카테고리가 없습니다."
          options={options}
          selectedId={draft.categoryId}
          title="카테고리 선택"
          onClose={() => setPicker(undefined)}
          onSelect={(categoryId) => updateDraft({ ...draft, categoryId })}
        />
      )
    }
    if (picker === "payment") {
      const options: TransactionOption[] = availablePaymentMethods.map(
        (method) => ({
          id: method.id,
          label: paymentMethodLabel(method),
          description: paymentMethodDescription(method, members),
        }),
      )
      return (
        <TransactionOptionPickerModal
          clearLabel={
            draft.type === "expense" ? "현금 · 결제수단 없음" : undefined
          }
          emptyMessage={
            draft.type === "saving"
              ? "연결된 계좌가 없습니다. 웹 설정에서 계좌를 연결해 주세요."
              : "연결된 결제수단이 없습니다."
          }
          options={options}
          selectedId={draft.paymentMethodId}
          title={draft.type === "saving" ? "저축 계좌 선택" : "결제수단 선택"}
          onClose={() => setPicker(undefined)}
          onSelect={(paymentMethodId) =>
            updateDraft({ ...draft, paymentMethodId })
          }
        />
      )
    }
    if (picker === "actor") {
      const options: TransactionOption[] = members.map((member) => ({
        id: member.userId,
        label: member.nickname,
        description: ledgerRoleLabel(member.role),
      }))
      return (
        <TransactionOptionPickerModal
          clearLabel="공통 거래"
          emptyMessage="선택할 수 있는 가계부 멤버가 없습니다."
          options={options}
          selectedId={draft.actorUserId}
          title="거래자 선택"
          onClose={() => setPicker(undefined)}
          onSelect={(actorUserId) => updateDraft({ ...draft, actorUserId })}
        />
      )
    }
    return null
  }

  const errorMessage = formError ?? store.transactionMutationErrorMessage

  return (
    <Page edges={safeAreaEdges}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Content>
            <TopBar>
              <BackButton
                accessibilityLabel="거래 입력 닫기"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => router.back()}
              >
                <BackLabel>취소</BackLabel>
              </BackButton>
              <ScreenLabel>
                {transaction ? "거래 수정" : "거래 추가"}
              </ScreenLabel>
              <TopBarSpacer />
            </TopBar>

            <Intro>
              <IntroEyebrow>{store.currentLedgerName}</IntroEyebrow>
              <IntroTitle>
                {transaction
                  ? "거래 내용을 수정합니다."
                  : "새 거래를 기록합니다."}
              </IntroTitle>
              <IntroDescription>
                일반 거래만 저장되며 서버 확인 후 목록에 반영됩니다.
              </IntroDescription>
            </Intro>

            {errorMessage ? (
              <ErrorNotice accessibilityLiveRegion="assertive">
                {errorMessage}
              </ErrorNotice>
            ) : null}

            <Section>
              <SectionTitle>거래 유형</SectionTitle>
              <SegmentedRow>
                {(["expense", "income", "saving"] as const).map((type) => (
                  <SegmentButton
                    key={type}
                    $selected={draft.type === type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draft.type === type }}
                    onPress={() => selectType(type)}
                  >
                    <SegmentLabel $selected={draft.type === type}>
                      {transactionTypeLabel(type)}
                    </SegmentLabel>
                  </SegmentButton>
                ))}
              </SegmentedRow>
              {draft.type === "income" ? (
                <InlineNotice>
                  단건 수입은 부수입으로 등록됩니다. 급여는 고정 거래이므로
                  웹에서 등록해 주세요.
                </InlineNotice>
              ) : null}
            </Section>

            <Section>
              <SectionTitle>금액과 일시</SectionTitle>
              <Field>
                <FieldLabel>금액 *</FieldLabel>
                <AmountInput
                  accessibilityLabel="거래 금액"
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={mobileTheme.colors.subtle}
                  value={draft.amount}
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
                    accessibilityLabel="거래 날짜"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={mobileTheme.colors.subtle}
                    value={draft.date}
                    onChangeText={(date) => updateDraft({ ...draft, date })}
                  />
                </DateTimeField>
                <DateTimeField>
                  <FieldLabel>시간 *</FieldLabel>
                  <Input
                    accessibilityLabel="거래 시간"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    placeholder="HH:mm"
                    placeholderTextColor={mobileTheme.colors.subtle}
                    value={draft.time}
                    onChangeText={(time) => updateDraft({ ...draft, time })}
                  />
                </DateTimeField>
              </DateTimeRow>
              <QuickDateButton
                accessibilityRole="button"
                onPress={setCurrentDateTime}
              >
                <QuickDateLabel>오늘 · 현재 시각으로 설정</QuickDateLabel>
              </QuickDateButton>
            </Section>

            <Section>
              <SectionTitle>분류</SectionTitle>
              <SelectionField
                label="카테고리 *"
                placeholder="카테고리를 선택해 주세요."
                value={
                  category
                    ? `${getCategoryLabel(categories, category.id)}${
                        category.isArchived ? " · 보관됨" : ""
                      }`
                    : undefined
                }
                onPress={() => setPicker("category")}
              />
              {draft.type !== "income" ? (
                <SelectionField
                  label={draft.type === "saving" ? "저축 계좌 *" : "결제수단"}
                  placeholder={
                    draft.type === "saving"
                      ? "계좌를 선택해 주세요."
                      : "현금 · 결제수단 없음"
                  }
                  value={
                    paymentMethod
                      ? paymentMethodLabel(paymentMethod)
                      : undefined
                  }
                  onPress={() => setPicker("payment")}
                />
              ) : null}
              <SelectionField
                label="거래자"
                placeholder="공통 거래"
                value={actor?.nickname}
                onPress={() => setPicker("actor")}
              />
            </Section>

            <Section>
              <SectionTitle>거래 내용</SectionTitle>
              <Field>
                <FieldLabel>가맹점</FieldLabel>
                <Input
                  accessibilityLabel="가맹점"
                  placeholder="예: 동네마트"
                  placeholderTextColor={mobileTheme.colors.subtle}
                  value={draft.merchantName}
                  onChangeText={(merchantName) =>
                    updateDraft({ ...draft, merchantName })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>메모</FieldLabel>
                <MemoInput
                  accessibilityLabel="거래 메모"
                  multiline
                  placeholder="기억할 내용을 입력해 주세요."
                  placeholderTextColor={mobileTheme.colors.subtle}
                  textAlignVertical="top"
                  value={draft.memo}
                  onChangeText={(memo) => updateDraft({ ...draft, memo })}
                />
              </Field>
              <Field>
                <FieldLabel>태그</FieldLabel>
                <Input
                  accessibilityLabel="거래 태그"
                  autoCapitalize="none"
                  placeholder="여행, 가족 · 쉼표로 구분"
                  placeholderTextColor={mobileTheme.colors.subtle}
                  value={draft.tagsInput}
                  onChangeText={(tagsInput) =>
                    updateDraft({ ...draft, tagsInput })
                  }
                />
                <FieldHint>
                  20자 이내, 최대 10개까지 입력할 수 있습니다.
                </FieldHint>
              </Field>
            </Section>

            <Section>
              <SectionTitle>합계 반영</SectionTitle>
              <SegmentedRow>
                {(
                  [
                    { label: "확정", value: "confirmed" },
                    { label: "합계 제외", value: "excluded" },
                  ] as const
                ).map((option) => (
                  <SegmentButton
                    key={option.value}
                    $selected={draft.status === option.value}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: draft.status === option.value,
                    }}
                    onPress={() =>
                      updateDraft({ ...draft, status: option.value })
                    }
                  >
                    <SegmentLabel $selected={draft.status === option.value}>
                      {option.label}
                    </SegmentLabel>
                  </SegmentButton>
                ))}
              </SegmentedRow>
              <FieldHint>
                합계 제외 거래도 목록에는 남지만 월 합계와 예산에는 반영되지
                않습니다.
              </FieldHint>
            </Section>

            <SubmitArea>
              <AppButton
                disabled={isSaving}
                label={
                  isSaving
                    ? "서버에 저장 중..."
                    : transaction
                      ? "거래 수정"
                      : "거래 등록"
                }
                tone="primary"
                onPress={requestSave}
              />
              <SubmitHint>
                저장에 실패하면 이 화면과 입력 내용이 그대로 유지됩니다.
              </SubmitHint>
            </SubmitArea>
          </Content>
        </ScrollView>
      </KeyboardAvoidingView>
      {renderPicker()}
    </Page>
  )
})

interface SelectionFieldProps {
  label: string
  placeholder: string
  value?: string
  onPress: () => void
}

function SelectionField({
  label,
  placeholder,
  value,
  onPress,
}: SelectionFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SelectionButton accessibilityRole="button" onPress={onPress}>
        <SelectionValue $placeholder={!value} numberOfLines={2}>
          {value ?? placeholder}
        </SelectionValue>
        <SelectionAction>선택</SelectionAction>
      </SelectionButton>
    </Field>
  )
}

interface EditorStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function EditorState({ actionLabel, message, onAction }: EditorStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateMessage accessibilityLiveRegion="polite">{message}</StateMessage>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} tone="primary" onPress={onAction} />
        ) : null}
      </StateContent>
    </Page>
  )
}

function transactionTypeLabel(type: TransactionType): string {
  if (type === "income") return "수입"
  if (type === "saving") return "저축"
  return "지출"
}

function paymentMethodLabel(method: PaymentMethod): string {
  const type = method.type === "bank" ? "계좌" : "카드"
  const issuer = method.issuer ? `${method.issuer} · ` : ""
  const last4 = method.last4 ? ` (${method.last4})` : ""
  return `[${type}] ${issuer}${method.name}${last4}`
}

function paymentMethodDescription(
  method: PaymentMethod,
  members: LedgerMember[],
): string | undefined {
  const owner = members.find((member) => member.userId === method.ownerUserId)
  return (
    [owner?.nickname, method.isPrimary ? "주 결제수단" : undefined]
      .filter(Boolean)
      .join(" · ") || undefined
  )
}

function ledgerRoleLabel(role: LedgerMember["role"]): string {
  if (role === "owner") return "가계부 소유자"
  if (role === "admin") return "관리자"
  if (role === "viewer") return "조회자"
  return "구성원"
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

const BackButton = styled.Pressable({
  minWidth: 56,
  minHeight: 40,
  justifyContent: "center",
})

const BackLabel = styled.Text({
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

const IntroEyebrow = styled.Text({
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

const ErrorNotice = styled.Text({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 12,
  fontWeight: "700",
  lineHeight: 18,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
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
  fontSize: 14,
  fontWeight: "900",
})

const SegmentedRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
})

const SegmentButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingHorizontal: mobileTheme.spacing[2],
  }),
)

const SegmentLabel = styled.Text<{ $selected: boolean }>(({ $selected }) => ({
  color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted,
  fontSize: 12,
  fontWeight: "800",
}))

const InlineNotice = styled.Text({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.violet,
  backgroundColor: mobileTheme.colors.violetSoft,
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[3],
})

const Field = styled.View({ gap: mobileTheme.spacing[2] })

const FieldLabel = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 11,
  fontWeight: "800",
})

const Input = styled.TextInput({
  minHeight: 46,
  borderWidth: 1,
  borderColor: mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.ink,
  fontSize: 13,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[3],
})

const AmountInput = styled(Input)({
  minHeight: 56,
  fontSize: 24,
  fontWeight: "900",
  textAlign: "right",
})

const AmountPreview = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
  textAlign: "right",
})

const DateTimeRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[3],
})

const DateTimeField = styled.View({ minWidth: 0, flex: 1, gap: 8 })

const QuickDateButton = styled.Pressable({
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
})

const QuickDateLabel = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})

const SelectionButton = styled.Pressable({
  minHeight: 50,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[3],
})

const SelectionValue = styled.Text<{ $placeholder: boolean }>(
  ({ $placeholder }) => ({
    minWidth: 0,
    flex: 1,
    color: $placeholder ? mobileTheme.colors.subtle : mobileTheme.colors.ink,
    fontSize: 12,
    fontWeight: $placeholder ? "500" : "700",
    lineHeight: 18,
  }),
)

const SelectionAction = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "800",
})

const MemoInput = styled(Input)({ minHeight: 96 })

const FieldHint = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
})

const SubmitArea = styled.View({ gap: mobileTheme.spacing[2] })

const SubmitHint = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
  textAlign: "center",
})

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[5],
})

const StateMessage = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})
