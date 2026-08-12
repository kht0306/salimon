import styled from "@emotion/native"
import { getCategoryLabel } from "@salimon/domain"
import type { Category } from "@salimon/types"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { mobileTheme } from "../../theme"

interface CategoryFilterModalProps {
  categories: Category[]
  selectedCategoryId: string
  visible: boolean
  onClose: () => void
  onSelect: (categoryId: string) => void
}

interface CategoryOption {
  category?: Category
  id: string
  label: string
}

const safeAreaEdges = ["bottom"] as const

export function CategoryFilterModal({
  categories,
  selectedCategoryId,
  visible,
  onClose,
  onSelect,
}: CategoryFilterModalProps) {
  const [query, setQuery] = useState("")
  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")
    const categoryOptions = categories.map<CategoryOption>((category) => ({
      category,
      id: category.id,
      label: getCategoryLabel(categories, category.id),
    }))

    if (!normalizedQuery) return categoryOptions
    return categoryOptions.filter((option) =>
      option.label.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
    )
  }, [categories, query])

  function selectCategory(categoryId: string): void {
    onSelect(categoryId === selectedCategoryId ? "" : categoryId)
    setQuery("")
    onClose()
  }

  function closeModal(): void {
    setQuery("")
    onClose()
  }

  return (
    <Modal
      animationType="slide"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={closeModal}
    >
      <ModalRoot>
        <Backdrop
          accessibilityLabel="카테고리 선택 닫기"
          accessibilityRole="button"
          onPress={closeModal}
        />
        <Sheet edges={safeAreaEdges}>
          <SheetHandle />
          <SheetHeader>
            <SheetHeading>
              <SheetTitle accessibilityRole="header">카테고리 선택</SheetTitle>
              <SheetDescription>
                검색하거나 목록에서 하나를 선택하세요.
              </SheetDescription>
            </SheetHeading>
            <CloseButton accessibilityRole="button" onPress={closeModal}>
              <CloseButtonLabel>닫기</CloseButtonLabel>
            </CloseButton>
          </SheetHeader>

          <SearchInput
            accessibilityLabel="카테고리 검색"
            autoCorrect={false}
            placeholder="카테고리 이름 검색"
            placeholderTextColor={mobileTheme.colors.subtle}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />

          {!query.trim() ? (
            <CategoryRow
              $selected={!selectedCategoryId}
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedCategoryId }}
              onPress={() => selectCategory("")}
            >
              <CategoryCopy>
                <CategoryName $selected={!selectedCategoryId}>
                  전체 카테고리
                </CategoryName>
                <CategoryStatus>카테고리 필터를 적용하지 않음</CategoryStatus>
              </CategoryCopy>
              {!selectedCategoryId ? <SelectedMark>선택됨</SelectedMark> : null}
            </CategoryRow>
          ) : null}

          <CategoryList
            contentContainerStyle={styles.listContent}
            data={options}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.id}
            ListEmptyComponent={
              <EmptyMessage>검색 결과가 없습니다.</EmptyMessage>
            }
            renderItem={({ item }) => {
              const selected = item.id === selectedCategoryId
              return (
                <CategoryRow
                  $selected={selected}
                  accessibilityLabel={`${item.label}${
                    selected ? ", 선택됨, 다시 누르면 해제" : ""
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectCategory(item.id)}
                >
                  <CategoryMarker
                    style={{
                      backgroundColor:
                        item.category?.color ?? mobileTheme.colors.subtle,
                    }}
                  />
                  <CategoryCopy>
                    <CategoryName $selected={selected} numberOfLines={2}>
                      {item.label}
                    </CategoryName>
                    {item.category?.isArchived ? (
                      <CategoryStatus>보관된 카테고리</CategoryStatus>
                    ) : null}
                  </CategoryCopy>
                  {selected ? <SelectedMark>선택됨</SelectedMark> : null}
                </CategoryRow>
              )
            }}
            showsVerticalScrollIndicator={false}
          />
        </Sheet>
      </ModalRoot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: mobileTheme.spacing[4] },
})

const ModalRoot = styled.View({
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: "rgba(24, 24, 27, 0.38)",
})

const Backdrop = styled.Pressable({
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

const Sheet = styled(SafeAreaView)({
  width: "100%",
  height: "86%",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  backgroundColor: mobileTheme.colors.panel,
  paddingTop: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[4],
})

const SheetHandle = styled.View({
  width: 36,
  height: 4,
  alignSelf: "center",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: mobileTheme.colors.borderStrong,
})

const SheetHeader = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  paddingVertical: mobileTheme.spacing[4],
})

const SheetHeading = styled.View({ flex: 1, gap: mobileTheme.spacing[1] })

const SheetTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 20,
  fontWeight: "900",
})

const SheetDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

const CloseButton = styled.Pressable({
  minWidth: 48,
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
})

const CloseButtonLabel = styled.Text({
  color: mobileTheme.colors.teal,
  fontSize: 12,
  fontWeight: "800",
})

const SearchInput = styled.TextInput({
  minHeight: 48,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panelSubtle,
  color: mobileTheme.colors.ink,
  fontSize: 13,
  paddingHorizontal: mobileTheme.spacing[4],
  marginBottom: mobileTheme.spacing[3],
})

const CategoryList = styled(FlatList<CategoryOption>)({ flex: 1 })

const CategoryRow = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: mobileTheme.colors.border,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingVertical: mobileTheme.spacing[3],
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)

const CategoryMarker = styled.View({
  width: 10,
  height: 10,
  flexShrink: 0,
  borderRadius: mobileTheme.radii.round,
})

const CategoryCopy = styled.View({ minWidth: 0, flex: 1 })

const CategoryName = styled.Text<{ $selected: boolean }>(({ $selected }) => ({
  color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
  fontSize: 13,
  fontWeight: $selected ? "800" : "600",
  lineHeight: 19,
}))

const CategoryStatus = styled.Text({
  marginTop: mobileTheme.spacing[1],
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
})

const SelectedMark = styled.Text({
  flexShrink: 0,
  color: mobileTheme.colors.teal,
  fontSize: 10,
  fontWeight: "800",
})

const EmptyMessage = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
})
