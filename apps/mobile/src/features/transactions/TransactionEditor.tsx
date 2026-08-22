import styled from "@emotion/native"
import {
  formatKrw,
  getCategoryLabel,
  isSplitCategory,
  splitInstallmentPrincipal,
  toDateKey,
} from "@salimon/domain"
import type {
  Category,
  LedgerMember,
  PaymentMethod,
  RecurringRule,
  Transaction,
  TransactionSplit,
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
  Switch,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import {
  changeMobileTransactionType,
  createCopiedMobileTransactionDraft,
  createEditingMobileTransactionDraft,
  createNewMobileTransactionDraft,
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
  copyTransactionId?: string
  transactionId?: string
}

const safeAreaEdges = ["top", "bottom"] as const
const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined

export const TransactionEditorScreen = observer(
  function TransactionEditorScreen({
    transactionId,
    copyTransactionId,
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
      ? [
          ...store.financeData.transactions,
          ...(store.transactionSearchTransactions ?? []),
        ].find((item) => item.id === transactionId && !item.deletedAt)
      : undefined
    const copySource = copyTransactionId
      ? [
          ...store.financeData.transactions,
          ...(store.transactionSearchTransactions ?? []),
        ].find((item) => item.id === copyTransactionId && !item.deletedAt)
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
    if (copyTransactionId && !copySource) {
      return (
        <EditorState
          actionLabel="거래 목록으로 돌아가기"
          message="현재 불러온 월에서 복사할 거래를 찾지 못했습니다."
          onAction={() => router.replace("/transactions")}
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
    const sourceTransaction = transaction ?? copySource
    const sourceSplits = sourceTransaction
      ? [
          ...store.financeData.transactionSplits,
          ...(store.transactionSearchSplits ?? []),
        ]
          .filter((split) => split.transactionId === sourceTransaction.id)
          .filter(
            (split, index, splits) =>
              splits.findIndex((item) => item.id === split.id) === index,
          )
      : []
    const recurringRule = sourceTransaction?.recurringRuleId
      ? store.financeData.recurringRules.find(
          (rule) => rule.id === sourceTransaction.recurringRuleId,
        )
      : undefined

    return (
      <TransactionEditorForm
        key={
          transaction?.id ??
          (copySource
            ? `copy-${copySource.id}`
            : `new-${store.selectedLedgerId}`)
        }
        categories={categories}
        copySource={copySource}
        members={members}
        paymentMethods={paymentMethods}
        recurringRule={recurringRule}
        selectedDate={store.selectedDate}
        sourceSplits={sourceSplits}
        transaction={transaction}
      />
    )
  },
)

interface TransactionEditorFormProps {
  categories: Category[]
  copySource?: Transaction
  members: LedgerMember[]
  paymentMethods: PaymentMethod[]
  recurringRule?: RecurringRule
  selectedDate: string
  sourceSplits: TransactionSplit[]
  transaction?: Transaction
}

type PickerKind = "actor" | "category" | "payment"

const TransactionEditorForm = observer(function TransactionEditorForm({
  categories,
  copySource,
  members,
  paymentMethods,
  recurringRule,
  selectedDate,
  sourceSplits,
  transaction,
}: TransactionEditorFormProps) {
  const store = useMobileAppStore()
  const [draft, setDraft] = useState<MobileTransactionDraft>(() =>
    transaction
      ? createEditingMobileTransactionDraft(
          transaction,
          sourceSplits,
          recurringRule,
        )
      : copySource
        ? createCopiedMobileTransactionDraft(copySource, sourceSplits)
        : createNewMobileTransactionDraft({
            actorUserId: store.authUser?.id,
            categories,
            paymentMethods,
            selectedDate,
          }),
  )
  const [formError, setFormError] = useState<string>()
  const [picker, setPicker] = useState<PickerKind>()
  const [splitPickerIndex, setSplitPickerIndex] = useState<number>()
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
    .filter(
      (method) =>
        draft.recurringType !== "installment" || method.type === "card",
    )
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
  const splitCategorySelected = isSplitCategory(category)
  const availableSplitCategories = availableCategories.filter(
    (category) => !isSplitCategory(category),
  )
  const amount = Number(draft.amount)
  const amountPreview =
    Number.isSafeInteger(amount) && amount > 0
      ? formatKrw(amount)
      : "금액 미입력"
  const splitTotal = draft.splits.reduce(
    (sum, split) => sum + Number(split.amount || 0),
    0,
  )
  const installmentMonths = Number(draft.installmentMonths)
  const installmentAmounts =
    draft.recurringType === "installment" &&
    draft.installmentAmountType === "principal" &&
    Number.isSafeInteger(amount) &&
    Number.isSafeInteger(installmentMonths) &&
    amount > 0 &&
    installmentMonths > 0
      ? splitInstallmentPrincipal(amount, installmentMonths)
      : []

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

  function selectIncomeKind(
    incomeKind: MobileTransactionDraft["incomeKind"],
  ): void {
    updateDraft({
      ...draft,
      incomeKind,
      recurringType: incomeKind === "salary" ? "fixed" : draft.recurringType,
    })
  }

  function selectRecurringType(
    recurringType: MobileTransactionDraft["recurringType"],
  ): void {
    updateDraft({
      ...draft,
      recurringType,
      splits: recurringType ? [] : draft.splits,
      paymentMethodId:
        recurringType === "installment" && paymentMethod?.type !== "card"
          ? (availablePaymentMethods.find((method) => method.type === "card")
              ?.id ?? "")
          : draft.paymentMethodId,
    })
  }

  function selectCategory(categoryId: string): void {
    const nextCategory = categories.find((item) => item.id === categoryId)
    updateDraft({
      ...draft,
      categoryId,
      recurringType: isSplitCategory(nextCategory) ? "" : draft.recurringType,
      splits: isSplitCategory(nextCategory)
        ? draft.splits.length >= 2
          ? draft.splits
          : [
              { amount: "", categoryId: "" },
              { amount: "", categoryId: "" },
            ]
        : [],
    })
  }

  function updateSplit(
    index: number,
    value: MobileTransactionDraft["splits"][number],
  ): void {
    updateDraft({
      ...draft,
      splits: draft.splits.map((split, splitIndex) =>
        splitIndex === index ? value : split,
      ),
    })
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
      transactionSplits: sourceSplits,
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
        if (result.transactionId) {
          router.replace({
            pathname: "/transactions/[id]",
            params: { id: result.transactionId },
          })
        } else {
          router.replace("/transactions")
        }
      }
    } finally {
      savingRef.current = false
    }
  }

  function renderPicker(): React.ReactNode {
    if (splitPickerIndex !== undefined) {
      const split = draft.splits[splitPickerIndex]
      const usedCategoryIds = new Set(
        draft.splits
          .filter((_, index) => index !== splitPickerIndex)
          .map((item) => item.categoryId),
      )
      const options: TransactionOption[] = availableSplitCategories
        .filter(
          (item) =>
            !usedCategoryIds.has(item.id) || item.id === split?.categoryId,
        )
        .map((item) => ({
          id: item.id,
          label: getCategoryLabel(categories, item.id),
          description: item.isArchived ? "보관된 카테고리" : undefined,
          color: item.color,
        }))
      return (
        <TransactionOptionPickerModal
          emptyMessage="분할에 사용할 다른 카테고리가 없습니다."
          options={options}
          selectedId={split?.categoryId}
          title={`분할 항목 ${splitPickerIndex + 1} 카테고리`}
          onClose={() => setSplitPickerIndex(undefined)}
          onSelect={(categoryId) => {
            if (split) updateSplit(splitPickerIndex, { ...split, categoryId })
            setSplitPickerIndex(undefined)
          }}
        />
      )
    }
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
          onSelect={selectCategory}
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

  const mutationErrorMessage = store.transactionMutationErrorMessage

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
                {transaction
                  ? "거래 수정"
                  : copySource
                    ? "거래 복사"
                    : "거래 추가"}
              </ScreenLabel>
              <TopBarSpacer />
            </TopBar>

            <Intro>
              <IntroEyebrow>{store.currentLedgerName}</IntroEyebrow>
              <IntroTitle>
                {transaction
                  ? "거래 내용을 수정합니다."
                  : copySource
                    ? "기존 내용을 복사해 새 거래를 만듭니다."
                    : "새 거래를 기록합니다."}
              </IntroTitle>
              <IntroDescription>
                일반·고정·할부·분할 거래를 저장하고 서버 확인 후 목록에
                반영합니다.
              </IntroDescription>
            </Intro>

            {formError ? (
              <ErrorNotice accessibilityLiveRegion="assertive">
                {formError}
              </ErrorNotice>
            ) : null}

            <Section>
              <SectionTitle>거래 유형</SectionTitle>
              <SegmentedRow>
                {(["expense", "income", "saving"] as const).map((type) => (
                  <SegmentButton
                    key={type}
                    $selected={draft.type === type}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draft.type === type }}
                    disabled={Boolean(transaction?.recurringType)}
                    onPress={() => selectType(type)}
                  >
                    <SegmentLabel $selected={draft.type === type}>
                      {transactionTypeLabel(type)}
                    </SegmentLabel>
                  </SegmentButton>
                ))}
              </SegmentedRow>
              {draft.type === "income" ? (
                <>
                  <FieldLabel>수입 종류</FieldLabel>
                  <SegmentedRow>
                    {(
                      [
                        { label: "부수입", value: "side_income" },
                        { label: "급여", value: "salary" },
                      ] as const
                    ).map((option) => (
                      <SegmentButton
                        key={option.value}
                        $selected={draft.incomeKind === option.value}
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected: draft.incomeKind === option.value,
                        }}
                        disabled={Boolean(transaction?.recurringType)}
                        onPress={() => selectIncomeKind(option.value)}
                      >
                        <SegmentLabel
                          $selected={draft.incomeKind === option.value}
                        >
                          {option.label}
                        </SegmentLabel>
                      </SegmentButton>
                    ))}
                  </SegmentedRow>
                  {draft.incomeKind === "salary" ? (
                    <InlineNotice>
                      급여는 매월 반복되는 고정 수입으로 등록됩니다.
                    </InlineNotice>
                  ) : null}
                </>
              ) : null}
            </Section>

            <Section>
              <SectionTitle>거래 방식</SectionTitle>
              <SegmentedRow>
                {(
                  [
                    { label: "일반", value: "" },
                    { label: "고정", value: "fixed" },
                    ...(draft.type === "expense"
                      ? [{ label: "할부", value: "installment" } as const]
                      : []),
                  ] as const
                ).map((option) => (
                  <SegmentButton
                    key={option.value || "general"}
                    $selected={draft.recurringType === option.value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: draft.recurringType === option.value,
                    }}
                    disabled={
                      Boolean(transaction?.recurringType) ||
                      (draft.type === "income" &&
                        draft.incomeKind === "salary" &&
                        option.value !== "fixed") ||
                      splitCategorySelected
                    }
                    onPress={() => selectRecurringType(option.value)}
                  >
                    <SegmentLabel
                      $selected={draft.recurringType === option.value}
                    >
                      {option.label}
                    </SegmentLabel>
                  </SegmentButton>
                ))}
              </SegmentedRow>
              {splitCategorySelected ? (
                <InlineNotice>
                  분할 거래는 일반 거래로 저장되며 반복 설정과 함께 사용할 수
                  없습니다.
                </InlineNotice>
              ) : null}
              {draft.recurringType === "installment" ? (
                <>
                  <Field>
                    <FieldLabel>할부 개월 *</FieldLabel>
                    <Input
                      accessibilityLabel="할부 개월"
                      editable={!transaction}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="2"
                      placeholderTextColor={mobileTheme.colors.subtle}
                      value={draft.installmentMonths}
                      onChangeText={(installmentMonths) =>
                        updateDraft({
                          ...draft,
                          installmentMonths:
                            normalizeAmountInput(installmentMonths),
                        })
                      }
                    />
                  </Field>
                  {!transaction ? (
                    <SegmentedRow>
                      {(
                        [
                          { label: "월 납입액", value: "monthly" },
                          { label: "총 원금", value: "principal" },
                        ] as const
                      ).map((option) => (
                        <SegmentButton
                          key={option.value}
                          $selected={
                            draft.installmentAmountType === option.value
                          }
                          accessibilityRole="radio"
                          accessibilityState={{
                            selected:
                              draft.installmentAmountType === option.value,
                          }}
                          onPress={() =>
                            updateDraft({
                              ...draft,
                              installmentAmountType: option.value,
                            })
                          }
                        >
                          <SegmentLabel
                            $selected={
                              draft.installmentAmountType === option.value
                            }
                          >
                            {option.label}
                          </SegmentLabel>
                        </SegmentButton>
                      ))}
                    </SegmentedRow>
                  ) : null}
                  {installmentAmounts[0] ? (
                    <InlineNotice>
                      첫 달 {formatKrw(installmentAmounts[0])} · 마지막 달에
                      나머지 금액을 반영합니다.
                    </InlineNotice>
                  ) : (
                    <FieldHint>
                      구매일을 기준으로 선택한 카드 결제일에 회차가 생성됩니다.
                    </FieldHint>
                  )}
                </>
              ) : null}
              {transaction?.recurringType ? (
                <ScopeRow>
                  <ScopeText>
                    <ScopeTitle>이 달 이후 거래에도 변경 적용</ScopeTitle>
                    <FieldHint>
                      끄면 선택한 회차만 변경하고, 켜면 이후 회차에도
                      반영합니다.
                    </FieldHint>
                  </ScopeText>
                  <Switch
                    accessibilityLabel="이 달 이후 거래에도 변경 적용"
                    value={draft.applyChangesToFuture}
                    onValueChange={(applyChangesToFuture) =>
                      updateDraft({ ...draft, applyChangesToFuture })
                    }
                  />
                </ScopeRow>
              ) : null}
            </Section>

            <Section>
              <SectionTitle>금액과 일시</SectionTitle>
              <Field>
                <FieldLabel>
                  {draft.recurringType === "installment" &&
                  draft.installmentAmountType === "principal" &&
                  !transaction
                    ? "할부 총 원금 *"
                    : "금액 *"}
                </FieldLabel>
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
                    editable={!transaction?.recurringType}
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
                    editable={!transaction?.recurringType}
                    placeholder="HH:mm"
                    placeholderTextColor={mobileTheme.colors.subtle}
                    value={draft.time}
                    onChangeText={(time) => updateDraft({ ...draft, time })}
                  />
                </DateTimeField>
              </DateTimeRow>
              <QuickDateButton
                accessibilityRole="button"
                disabled={Boolean(transaction?.recurringType)}
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
              {splitCategorySelected ? (
                <SplitList>
                  {draft.splits.map((split, index) => {
                    const splitCategory = categories.find(
                      (item) => item.id === split.categoryId,
                    )
                    return (
                      <SplitItem key={`split-${index}`}>
                        <SplitItemHeader>
                          <FieldLabel>분할 항목 {index + 1}</FieldLabel>
                          {draft.splits.length > 2 ? (
                            <RemoveSplitButton
                              accessibilityLabel={`분할 항목 ${index + 1} 삭제`}
                              accessibilityRole="button"
                              onPress={() =>
                                updateDraft({
                                  ...draft,
                                  splits: draft.splits.filter(
                                    (_, splitIndex) => splitIndex !== index,
                                  ),
                                })
                              }
                            >
                              <RemoveSplitLabel>삭제</RemoveSplitLabel>
                            </RemoveSplitButton>
                          ) : null}
                        </SplitItemHeader>
                        <SelectionField
                          label="카테고리 *"
                          placeholder="분할 카테고리 선택"
                          value={
                            splitCategory
                              ? getCategoryLabel(categories, splitCategory.id)
                              : undefined
                          }
                          onPress={() => setSplitPickerIndex(index)}
                        />
                        <Field>
                          <FieldLabel>금액 *</FieldLabel>
                          <Input
                            accessibilityLabel={`분할 항목 ${index + 1} 금액`}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={mobileTheme.colors.subtle}
                            value={split.amount}
                            onChangeText={(value) =>
                              updateSplit(index, {
                                ...split,
                                amount: normalizeAmountInput(value),
                              })
                            }
                          />
                        </Field>
                      </SplitItem>
                    )
                  })}
                  <SplitSummary $valid={splitTotal === amount && amount > 0}>
                    분할 합계 {formatKrw(splitTotal)} / 거래 금액{" "}
                    {amountPreview}
                  </SplitSummary>
                  {draft.splits.length < 10 ? (
                    <QuickDateButton
                      accessibilityRole="button"
                      onPress={() =>
                        updateDraft({
                          ...draft,
                          splits: [
                            ...draft.splits,
                            { amount: "", categoryId: "" },
                          ],
                        })
                      }
                    >
                      <QuickDateLabel>분할 항목 추가</QuickDateLabel>
                    </QuickDateButton>
                  ) : null}
                </SplitList>
              ) : null}
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
                  onPress={() => {
                    if (transaction?.recurringType !== "installment") {
                      setPicker("payment")
                    }
                  }}
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
                    accessibilityRole="radio"
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
              {mutationErrorMessage ? (
                <ErrorNotice accessibilityLiveRegion="assertive">
                  {mutationErrorMessage}
                </ErrorNotice>
              ) : null}
              <AppButton
                disabled={isSaving}
                label={
                  isSaving
                    ? "서버에 저장 중..."
                    : mutationErrorMessage
                      ? transaction
                        ? "다시 수정 시도"
                        : "다시 등록 시도"
                      : transaction
                        ? "거래 수정"
                        : "거래 등록"
                }
                tone="primary"
                onPress={requestSave}
              />
              <SubmitHint>
                저장이 15초 이상 지연되면 요청을 중단하며 입력 내용은 그대로
                유지됩니다.
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
      <SelectionButton
        accessibilityHint="선택 목록을 엽니다."
        accessibilityLabel={`${label}, ${value ?? placeholder}`}
        accessibilityRole="button"
        onPress={onPress}
      >
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
  minHeight: mobileTheme.controls.touch,
  justifyContent: "center",
})

const BackLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "600",
})

const ScreenLabel = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 15,
  fontWeight: "600",
})

const TopBarSpacer = styled.View({ width: 56 })

const Intro = styled.View({ gap: mobileTheme.spacing[1] })

const IntroEyebrow = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
})

const IntroTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  ...mobileTheme.typography.title,
})

const IntroDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  lineHeight: 18,
})

const ErrorNotice = styled(AppText)({
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

const SectionTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 14,
  fontWeight: "600",
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

const SegmentLabel = styled(AppText)<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  }),
)

const InlineNotice = styled(AppText)({
  borderLeftWidth: 3,
  borderLeftColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[3],
})

const ScopeRow = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
  padding: mobileTheme.spacing[3],
})

const ScopeText = styled.View({ minWidth: 0, flex: 1, gap: 4 })

const ScopeTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 11,
  fontWeight: "600",
})

const Field = styled.View({ gap: mobileTheme.spacing[2] })

const FieldLabel = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 11,
  fontWeight: "600",
})

const Input = styled.TextInput({
  minHeight: 46,
  borderWidth: 1,
  borderColor: mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panel,
  color: mobileTheme.colors.ink,
  fontFamily: "Pretendard",
  fontSize: 13,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[3],
})

const AmountInput = styled(Input)({
  minHeight: 56,
  fontSize: 24,
  fontWeight: "700",
  textAlign: "right",
})

const AmountPreview = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
  textAlign: "right",
})

const DateTimeRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[3],
})

const DateTimeField = styled.View({ minWidth: 0, flex: 1, gap: 8 })

const QuickDateButton = styled.Pressable({
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
})

const QuickDateLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
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

const SelectionValue = styled(AppText)<{ $placeholder: boolean }>(
  ({ $placeholder }) => ({
    minWidth: 0,
    flex: 1,
    color: $placeholder ? mobileTheme.colors.subtle : mobileTheme.colors.ink,
    fontSize: 12,
    fontWeight: $placeholder ? "400" : "600",
    lineHeight: 18,
  }),
)

const SelectionAction = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 11,
  fontWeight: "600",
})

const SplitList = styled.View({ gap: mobileTheme.spacing[3] })

const SplitItem = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.panelSubtle,
  padding: mobileTheme.spacing[3],
})

const SplitItemHeader = styled.View({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const RemoveSplitButton = styled.Pressable({
  minHeight: 32,
  justifyContent: "center",
  paddingHorizontal: mobileTheme.spacing[2],
})

const RemoveSplitLabel = styled(AppText)({
  color: mobileTheme.colors.coral,
  fontSize: 10,
  fontWeight: "600",
})

const SplitSummary = styled(AppText)<{ $valid: boolean }>(({ $valid }) => ({
  color: $valid ? mobileTheme.colors.teal : mobileTheme.colors.coral,
  fontSize: 11,
  fontWeight: "600",
  textAlign: "right",
}))

const MemoInput = styled(Input)({ minHeight: 96 })

const FieldHint = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 16,
})

const SubmitArea = styled.View({ gap: mobileTheme.spacing[2] })

const SubmitHint = styled(AppText)({
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
  padding: mobileTheme.spacing[4],
})

const StateMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})
