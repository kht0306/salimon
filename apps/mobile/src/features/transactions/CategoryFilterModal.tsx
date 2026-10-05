import { useTheme } from "@emotion/react"
import styled from "@emotion/native"
import type { Category } from "@salimon/types"
import { Minus, Plus } from "lucide-react-native"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
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
  const theme = useTheme()
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
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
        />
        <Sheet
          accessibilityViewIsModal
          edges={safeAreaEdges}
          importantForAccessibility="yes"
          onAccessibilityEscape={onClose}
        >
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
              <CloseButton
                accessibilityLabel="카테고리 선택 닫기"
                accessibilityRole="button"
                onPress={onClose}
              >
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
            placeholderTextColor={theme.colors.subtle}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />

          {!searching ? (
            <CategoryRow $depth={0}>
              <TreeControlSpacer />
              <CategoryChoice
                $selected={draftCategoryIds.length === 0}
                accessibilityLabel="전체 카테고리"
                accessibilityRole="button"
                accessibilityState={{ selected: draftCategoryIds.length === 0 }}
                onPress={() => setDraftCategoryIds([])}
              >
                <CategoryCopy>
                  <CategoryName $selected={draftCategoryIds.length === 0}>
                    전체 카테고리
                  </CategoryName>
                  <CategoryStatus>
                    선택한 카테고리를 모두 해제합니다.
                  </CategoryStatus>
                </CategoryCopy>
              </CategoryChoice>
            </CategoryRow>
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
                      <TreeControlIcon
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        {expanded ? (
                          <Minus
                            color={theme.colors.teal}
                            size={16}
                            strokeWidth={2}
                          />
                        ) : (
                          <Plus
                            color={theme.colors.teal}
                            size={16}
                            strokeWidth={2}
                          />
                        )}
                      </TreeControlIcon>
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
                          item.category.color ?? theme.colors.subtle,
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

const ModalRoot = styled.View(({ theme }) => ({
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: theme.colors.scrim,
}))

const Backdrop = styled.Pressable({
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

const Sheet = styled(SafeAreaView)(
  ({ theme }: { theme: typeof mobileTheme }) => ({
    width: "100%",
    height: "86%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: theme.colors.panel,
    paddingTop: mobileTheme.spacing[2],
    paddingHorizontal: mobileTheme.spacing[4],
  }),
)

const SheetHandle = styled.View(({ theme }) => ({
  width: 36,
  height: 4,
  alignSelf: "center",
  borderRadius: mobileTheme.radii.round,
  backgroundColor: theme.colors.borderStrong,
}))

const SheetHeader = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
  paddingVertical: mobileTheme.spacing[4],
})

const SheetHeading = styled.View({ minWidth: 0, flex: 1, gap: 2 })

const SheetTitle = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 20,
  fontWeight: "700",
}))

const SheetDescription = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
}))

const HeaderActions = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[1],
})

const CloseButton = styled.Pressable({
  minWidth: 44,
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
})

const CloseButtonLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 11,
  fontWeight: "600",
}))

const ApplyButton = styled.Pressable(({ theme }) => ({
  minWidth: 54,
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.teal,
  paddingHorizontal: mobileTheme.spacing[3],
}))

const ApplyButtonLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.onAccent,
  fontSize: 11,
  fontWeight: "600",
}))

const SearchInput = styled.TextInput(({ theme }) => ({
  minHeight: 48,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.panelSubtle,
  color: theme.colors.ink,
  fontFamily: "Pretendard",
  fontSize: 13,
  paddingHorizontal: mobileTheme.spacing[4],
  marginBottom: mobileTheme.spacing[3],
}))

const CategoryList = styled(FlatList<CategoryTreeOption>)({ flex: 1 })

const CategoryRow = styled.View<{ $depth: number }>(({ theme, $depth }) => ({
  minHeight: 58,
  flexDirection: "row",
  alignItems: "stretch",
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: Math.min($depth, 3) * mobileTheme.spacing[4],
}))

const TreeControl = styled.Pressable({
  width: mobileTheme.controls.touch,
  minHeight: 52,
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
})

const TreeControlSpacer = styled.View({
  width: mobileTheme.controls.touch,
  flexShrink: 0,
})

const TreeControlIcon = styled.View(({ theme }) => ({
  width: 24,
  height: 24,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: theme.colors.borderStrong,
  borderRadius: mobileTheme.radii.xs,
}))

const CategoryChoice = styled.Pressable<{ $selected: boolean }>(
  ({ theme, $selected }) => ({
    minWidth: 0,
    minHeight: 58,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: $selected ? theme.colors.tealSoft : theme.colors.panel,
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

const CategoryName = styled(AppText)<{ $selected: boolean }>(
  ({ theme, $selected }) => ({
    color: $selected ? theme.colors.teal : theme.colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  }),
)

const CategoryStatus = styled(AppText)(({ theme }) => ({
  marginTop: mobileTheme.spacing[1],
  color: theme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
}))

const EmptyMessage = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 12,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
}))
