import {
  buildCategoryTree,
  getCategoryLabel,
  isSplitCategory,
} from "@salimon/domain"
import type { Category, CategoryUsageType } from "@salimon/types"
import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import { Alert } from "react-native"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import type { MobileCategoryInput } from "../../stores/mobileAppStore"
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

const usageOptions: { label: string; value: CategoryUsageType }[] = [
  { label: "지출", value: "expense" },
  { label: "수입", value: "income" },
  { label: "저축", value: "saving" },
]

const initialDraft: MobileCategoryInput = {
  color: "#2d6a4f",
  icon: "circle",
  name: "",
  usageTypes: ["expense"],
}

export const CategoryManagementScreen = observer(
  function CategoryManagementScreen() {
    const store = useMobileAppStore()
    const [editingId, setEditingId] = useState<string>()
    const [draft, setDraft] = useState<MobileCategoryInput>(initialDraft)
    const [budget, setBudget] = useState("")
    const categoryTree = useMemo(
      () => buildCategoryTree(store.currentCategories),
      [store.currentCategories],
    )
    const busy = store.managementMutationState !== "idle"

    useEffect(() => {
      store.clearManagementFeedback()
    }, [store])

    function toggleUsage(usageType: CategoryUsageType): void {
      const selected = draft.usageTypes.includes(usageType)
      setDraft({
        ...draft,
        usageTypes: selected
          ? draft.usageTypes.filter((item) => item !== usageType)
          : [...draft.usageTypes, usageType],
      })
    }

    function startEditing(category: Category): void {
      setEditingId(category.id)
      setDraft({
        color: category.color,
        icon: category.icon,
        name: category.name,
        parentCategoryId: category.parentCategoryId,
        usageTypes: category.usageTypes,
      })
      setBudget(String(store.categoryBudgetAmount(category.id) || ""))
      store.clearManagementFeedback()
    }

    function resetForm(): void {
      setEditingId(undefined)
      setDraft(initialDraft)
      setBudget("")
    }

    async function saveCategory(): Promise<void> {
      const amount = Number(budget || 0)
      const saved = editingId
        ? await store.updateCategory(editingId, draft)
        : await store.createCategory(draft, amount)
      if (!saved) return
      if (editingId && draft.usageTypes.includes("expense")) {
        const budgetSaved = await store.setCategoryBudget(editingId, amount)
        if (!budgetSaved) return
      }
      resetForm()
    }

    function confirmArchive(category: Category): void {
      Alert.alert(
        "카테고리를 보관할까요?",
        "기존 거래에는 카테고리가 유지되며 새 거래에서는 선택할 수 없습니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "보관",
            style: "destructive",
            onPress: () => void store.archiveCategory(category.id),
          },
        ],
      )
    }

    return (
      <ManagementScaffold
        description="최대 3단계 카테고리와 월 예산을 모바일에서 관리합니다."
        title="카테고리·예산"
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
              {editingId ? "카테고리 수정" : "새 카테고리"}
            </SectionTitle>
            {editingId ? (
              <TextButton disabled={busy} onPress={resetForm}>
                <TextButtonLabel>새로 입력</TextButtonLabel>
              </TextButton>
            ) : null}
          </SectionHeading>
          <Field>
            <FieldLabel>이름 *</FieldLabel>
            <Input
              accessibilityLabel="카테고리 이름"
              maxLength={30}
              placeholder="예: 외식"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
            />
          </Field>
          <Field>
            <FieldLabel>적용 용도 *</FieldLabel>
            <InlineRow>
              {usageOptions.map((option) => {
                const selected = draft.usageTypes.includes(option.value)
                return (
                  <ChoiceButton
                    key={option.value}
                    $selected={selected}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleUsage(option.value)}
                  >
                    <ChoiceLabel $selected={selected}>
                      {option.label}
                    </ChoiceLabel>
                  </ChoiceButton>
                )
              })}
            </InlineRow>
          </Field>
          <Field>
            <FieldLabel>상위 카테고리</FieldLabel>
            <InlineRow>
              <ChoiceButton
                $selected={!draft.parentCategoryId}
                accessibilityRole="radio"
                accessibilityState={{ selected: !draft.parentCategoryId }}
                onPress={() =>
                  setDraft({ ...draft, parentCategoryId: undefined })
                }
              >
                <ChoiceLabel $selected={!draft.parentCategoryId}>
                  최상위
                </ChoiceLabel>
              </ChoiceButton>
              {categoryTree
                .filter(
                  ({ category, depth }) =>
                    depth < 3 &&
                    category.id !== editingId &&
                    !category.isArchived &&
                    !isSplitCategory(category),
                )
                .map(({ category }) => {
                  const selected = draft.parentCategoryId === category.id
                  return (
                    <ChoiceButton
                      key={category.id}
                      $selected={selected}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setDraft({
                          ...draft,
                          parentCategoryId: category.id,
                          usageTypes: category.usageTypes,
                        })
                      }
                    >
                      <ChoiceLabel $selected={selected}>
                        {getCategoryLabel(store.currentCategories, category.id)}
                      </ChoiceLabel>
                    </ChoiceButton>
                  )
                })}
            </InlineRow>
          </Field>
          <InlineRow>
            <Field style={{ flex: 1, minWidth: 150 }}>
              <FieldLabel>아이콘 키 *</FieldLabel>
              <Input
                accessibilityLabel="카테고리 아이콘"
                placeholder="utensils"
                value={draft.icon}
                onChangeText={(icon) => setDraft({ ...draft, icon })}
              />
            </Field>
            <Field style={{ flex: 1, minWidth: 150 }}>
              <FieldLabel>색상 HEX *</FieldLabel>
              <Input
                accessibilityLabel="카테고리 색상"
                autoCapitalize="none"
                maxLength={7}
                placeholder="#2d6a4f"
                value={draft.color}
                onChangeText={(color) => setDraft({ ...draft, color })}
              />
            </Field>
          </InlineRow>
          {draft.usageTypes.includes("expense") ? (
            <Field>
              <FieldLabel>{store.selectedMonth} 월 예산</FieldLabel>
              <Input
                accessibilityLabel="카테고리 월 예산"
                keyboardType="number-pad"
                placeholder="0"
                value={budget}
                onChangeText={(value) => setBudget(value.replace(/\D/g, ""))}
              />
            </Field>
          ) : null}
          <AppButton
            disabled={busy}
            label={
              busy ? "저장 중..." : editingId ? "수정 저장" : "카테고리 추가"
            }
            tone="primary"
            onPress={() => void saveCategory()}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>현재 가계부 카테고리</SectionTitle>
          <SectionDescription>
            같은 단계 안에서 순서를 바꿀 수 있습니다. 기본 카테고리는 보관할 수
            없습니다.
          </SectionDescription>
          {categoryTree.map(({ category, depth }) => (
            <ItemCard
              key={category.id}
              style={{ marginLeft: (depth - 1) * 12 }}
            >
              <ItemTitle>
                {category.name}
                {category.isArchived ? " · 보관됨" : ""}
              </ItemTitle>
              <ItemMeta>
                {category.usageTypes.join(" · ")} · 예산{" "}
                {store
                  .categoryBudgetAmount(category.id)
                  .toLocaleString("ko-KR")}
                원
              </ItemMeta>
              <InlineRow>
                <TextButton
                  disabled={busy}
                  onPress={() => startEditing(category)}
                >
                  <TextButtonLabel>수정</TextButtonLabel>
                </TextButton>
                <TextButton
                  disabled={busy}
                  onPress={() => void store.moveCategory(category.id, "up")}
                >
                  <TextButtonLabel>위로</TextButtonLabel>
                </TextButton>
                <TextButton
                  disabled={busy}
                  onPress={() => void store.moveCategory(category.id, "down")}
                >
                  <TextButtonLabel>아래로</TextButtonLabel>
                </TextButton>
                {!category.isDefault ? (
                  <TextButton
                    $danger
                    disabled={busy}
                    onPress={() => confirmArchive(category)}
                  >
                    <TextButtonLabel $danger>보관</TextButtonLabel>
                  </TextButton>
                ) : null}
              </InlineRow>
            </ItemCard>
          ))}
        </SectionCard>
      </ManagementScaffold>
    )
  },
)
