import styled from "@emotion/native"
import type { Category } from "@salimon/types"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { mobileTheme } from "../../theme"
import {
  buildCategoryTreeOptions,
  selectedCategoryAncestorIds,
  toggleCategorySelection,
  type CategoryTreeOption,
} from "./categoryFilterPresentation"

interface CategoryFilterModalProps {
  categories: Category[]
  selectedCategoryIds: string[]
  onApply: (categoryIds: string[]) => void
  onClose: () => void
}

const safeAreaEdges = ["bottom"] as const

export function CategoryFilterModal({
  categories,
  selectedCategoryIds,
  onApply,
  onClose,
}: CategoryFilterModalProps) {
  const [draftCategoryIds, setDraftCategoryIds] = useState(() => [
    ...selectedCategoryIds,
  ])
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(() =>
    selectedCategoryAncestorIds(categories, selectedCategoryIds),
  )
  const [query, setQuery] = useState("")
  const searching = Boolean(query.trim())
  const options = useMemo(
    () => buildCategoryTreeOptions(categories, expandedCategoryIds, query),
    [categories, expandedCategoryIds, query],
  )
  const draftCategoryIdSet = useMemo(
    () => new Set(draftCategoryIds),
    [draftCategoryIds],
  )

  function toggleCategory(categoryId: string): void {
    setDraftCategoryIds((current) =>
      toggleCategorySelection(current, categoryId),
    )
  }

  function toggleExpanded(categoryId: string): void {
    setExpandedCategoryIds((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  return (
    <Modal
      animationType="slide"
      statusBarTranslucent
      transparent
      visible
      onRequestClose={onClose}
    >
      <ModalRoot>
        <Backdrop
          accessibilityLabel="카테고리 선택 닫기"
          accessibilityRole="button"
          onPress={onClose}
        />
        <Sheet edges={safeAreaEdges}>
          <SheetHandle />
          <SheetHeader>
            <SheetHeading>
              <SheetTitle accessibilityRole="header">카테고리 선택</SheetTitle>
              <SheetDescription>
                대분류는 하위 분류를 포함합니다. 여러 항목 선택 후 적용해
                주세요.
              </SheetDescription>
            </SheetHeading>
            <HeaderActions>
              <CloseButton accessibilityRole="button" onPress={onClose}>
                <CloseButtonLabel>닫기</CloseButtonLabel>
              </CloseButton>
              <ApplyButton
                accessibilityLabel={`카테고리 ${draftCategoryIds.length}개 적용`}
                accessibilityRole="button"
                onPress={() => onApply(draftCategoryIds)}
              >
                <ApplyButtonLabel>
                  적용
                  {draftCategoryIds.length > 0
                    ? ` ${draftCategoryIds.length}`
                    : ""}
                </ApplyButtonLabel>
              </ApplyButton>
            </HeaderActions>
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

          {!searching ? (
            <CategoryChoice
              $selected={draftCategoryIds.length === 0}
              accessibilityLabel="전체 카테고리"
              accessibilityRole="button"
              accessibilityState={{ selected: draftCategoryIds.length === 0 }}
              onPress={() => setDraftCategoryIds([])}
            >
              <TreeControlSpacer />
              <CategoryCopy>
                <CategoryName $selected={draftCategoryIds.length === 0}>
                  전체 카테고리
                </CategoryName>
                <CategoryStatus>
                  선택한 카테고리를 모두 해제합니다.
                </CategoryStatus>
              </CategoryCopy>
            </CategoryChoice>
          ) : null}

          <CategoryList
            contentContainerStyle={styles.listContent}
            data={options}
            extraData={draftCategoryIds}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.category.id}
            ListEmptyComponent={
              <EmptyMessage>검색 결과가 없습니다.</EmptyMessage>
            }
            renderItem={({ item }) => {
              const selected = draftCategoryIdSet.has(item.category.id)
              const expanded = expandedCategoryIds.has(item.category.id)
              return (
                <CategoryRow $depth={item.depth}>
                  {!searching && item.hasChildren ? (
                    <TreeControl
                      accessibilityLabel={`${item.label} 하위 분류 ${
                        expanded ? "접기" : "펼치기"
                      }`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => toggleExpanded(item.category.id)}
                    >
                      <TreeControlLabel>
                        {expanded ? "−" : "+"}
                      </TreeControlLabel>
                    </TreeControl>
                  ) : (
                    <TreeControlSpacer />
                  )}
                  <CategoryChoice
                    $selected={selected}
                    accessibilityLabel={item.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleCategory(item.category.id)}
                  >
                    <CategoryMarker
                      style={{
                        backgroundColor:
                          item.category.color ?? mobileTheme.colors.subtle,
                      }}
                    />
                    <CategoryCopy>
                      <CategoryName $selected={selected} numberOfLines={2}>
                        {item.label}
                      </CategoryName>
                      {item.category.isArchived ? (
                        <CategoryStatus>보관된 카테고리</CategoryStatus>
                      ) : null}
                    </CategoryCopy>
                  </CategoryChoice>
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

const SheetHeading = styled.View({ minWidth: 0, flex: 1, gap: 2 })

const SheetTitle = styled.Text({
  color: mobileTheme.colors.ink,
  fontSize: 20,
  fontWeight: "900",
})

const SheetDescription = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
})

const HeaderActions = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[1],
})

const CloseButton = styled.Pressable({
  minWidth: 44,
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
})

const CloseButtonLabel = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  fontWeight: "800",
})

const ApplyButton = styled.Pressable({
  minWidth: 54,
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.teal,
  paddingHorizontal: mobileTheme.spacing[3],
})

const ApplyButtonLabel = styled.Text({
  color: mobileTheme.colors.panel,
  fontSize: 11,
  fontWeight: "900",
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

const CategoryList = styled(FlatList<CategoryTreeOption>)({ flex: 1 })

const CategoryRow = styled.View<{ $depth: number }>(({ $depth }) => ({
  minHeight: 58,
  flexDirection: "row",
  alignItems: "stretch",
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingLeft: Math.min($depth, 3) * mobileTheme.spacing[4],
}))

const TreeControl = styled.Pressable({
  width: 42,
  minHeight: 52,
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
})

const TreeControlSpacer = styled.View({ width: 42, flexShrink: 0 })

const TreeControlLabel = styled.Text({
  width: 24,
  height: 24,
  borderWidth: 1,
  borderColor: mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.xs,
  color: mobileTheme.colors.teal,
  fontSize: 17,
  fontWeight: "700",
  lineHeight: 21,
  textAlign: "center",
})

const CategoryChoice = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minWidth: 0,
    minHeight: 58,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderRadius: mobileTheme.radii.sm,
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

const EmptyMessage = styled.Text({
  color: mobileTheme.colors.muted,
  fontSize: 12,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
})
