import styled from "@emotion/native"
import {
  buildCategoryTree,
  getCategoryLabel,
  getCategoryPath,
} from "@salimon/domain"
import type { Category } from "@salimon/types"
import { ChevronRight } from "lucide-react-native"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

interface CategoryPickerModalProps {
  categories: Category[]
  emptyMessage: string
  selectedId: string
  title: string
  onClose: () => void
  onSelect: (id: string) => void
}

interface VisibleCategoryItem {
  category: Category
  depth: number
  hasChildren: boolean
}

const safeAreaEdges = ["bottom"] as const

export function CategoryPickerModal({
  categories,
  emptyMessage,
  selectedId,
  title,
  onClose,
  onSelect,
}: CategoryPickerModalProps) {
  const [query, setQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () =>
      new Set(
        getCategoryPath(categories, selectedId)
          .slice(0, -1)
          .map((category) => category.id),
      ),
  )
  const items = useMemo(
    () => buildVisibleCategories(categories, expandedIds, query),
    [categories, expandedIds, query],
  )

  function select(categoryId: string): void {
    onSelect(categoryId)
    onClose()
  }

  function toggleExpanded(categoryId: string): void {
    setExpandedIds((current) => {
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
            <SheetTitle accessibilityRole="header">{title}</SheetTitle>
            <CloseButton
              accessibilityLabel={`${title} 닫기`}
              accessibilityRole="button"
              onPress={onClose}
            >
              <CloseButtonLabel>닫기</CloseButtonLabel>
            </CloseButton>
          </SheetHeader>
          <PickerGuide>
            카테고리 이름을 누르면 선택하고, 화살표를 누르면 하위 항목을
            펼칩니다.
          </PickerGuide>
          <SearchInput
            accessibilityLabel={`${title} 검색`}
            autoCorrect={false}
            placeholder="카테고리 검색"
            placeholderTextColor={mobileTheme.colors.subtle}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />
          <CategoryList
            contentContainerStyle={styles.listContent}
            data={items}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.category.id}
            ListEmptyComponent={<EmptyMessage>{emptyMessage}</EmptyMessage>}
            renderItem={({ item }) => {
              const selected = item.category.id === selectedId
              const expanded = expandedIds.has(item.category.id)
              const categoryLabel = getCategoryLabel(
                categories,
                item.category.id,
              )
              return (
                <CategoryRow $selected={selected}>
                  <CategorySelectButton
                    $depth={item.depth}
                    accessibilityLabel={`${categoryLabel} 카테고리 선택`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => select(item.category.id)}
                  >
                    <CategoryMarker
                      style={{ backgroundColor: item.category.color }}
                    />
                    <CategoryCopy>
                      <CategoryName $selected={selected} numberOfLines={2}>
                        {query.trim() ? categoryLabel : item.category.name}
                      </CategoryName>
                      {selected ? <SelectedMark>선택됨</SelectedMark> : null}
                    </CategoryCopy>
                  </CategorySelectButton>
                  {item.hasChildren && !query.trim() ? (
                    <ExpandButton
                      accessibilityLabel={`${item.category.name} 하위 카테고리 ${expanded ? "접기" : "펼치기"}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => toggleExpanded(item.category.id)}
                    >
                      <ChevronRight
                        color={mobileTheme.colors.muted}
                        size={19}
                        strokeWidth={1.9}
                        style={{
                          transform: [{ rotate: expanded ? "90deg" : "0deg" }],
                        }}
                      />
                    </ExpandButton>
                  ) : (
                    <ExpandSpacer />
                  )}
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

function buildVisibleCategories(
  categories: Category[],
  expandedIds: ReadonlySet<string>,
  query: string,
): VisibleCategoryItem[] {
  const tree = buildCategoryTree(categories)
  const childCounts = new Map<string, number>()
  categories.forEach((category) => {
    if (!category.parentCategoryId) return
    childCounts.set(
      category.parentCategoryId,
      (childCounts.get(category.parentCategoryId) ?? 0) + 1,
    )
  })
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")

  return tree.reduce<VisibleCategoryItem[]>((visible, { category, depth }) => {
    if (normalizedQuery) {
      const label = getCategoryLabel(categories, category.id)
      if (label.toLocaleLowerCase("ko-KR").includes(normalizedQuery)) {
        visible.push({ category, depth: 1, hasChildren: false })
      }
      return visible
    }

    const ancestors = getCategoryPath(categories, category.id).slice(0, -1)
    if (ancestors.some((ancestor) => !expandedIds.has(ancestor.id))) {
      return visible
    }
    visible.push({
      category,
      depth,
      hasChildren: (childCounts.get(category.id) ?? 0) > 0,
    })
    return visible
  }, [])
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
  height: "78%",
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
  minHeight: 60,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const SheetTitle = styled(AppText)({
  color: mobileTheme.colors.ink,
  fontSize: 20,
  fontWeight: "700",
})

const CloseButton = styled.Pressable({
  minWidth: 52,
  minHeight: mobileTheme.controls.touch,
  alignItems: "flex-end",
  justifyContent: "center",
})

const CloseButtonLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "600",
})

const PickerGuide = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
  marginBottom: mobileTheme.spacing[3],
})

const SearchInput = styled.TextInput({
  minHeight: 48,
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panelSubtle,
  color: mobileTheme.colors.ink,
  fontFamily: "Pretendard",
  fontSize: 14,
  paddingHorizontal: mobileTheme.spacing[4],
  marginBottom: mobileTheme.spacing[3],
})

const CategoryList = styled(FlatList<VisibleCategoryItem>)({ flex: 1 })

const CategoryRow = styled.View<{ $selected: boolean }>(({ $selected }) => ({
  minHeight: 60,
  flexDirection: "row",
  alignItems: "stretch",
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: $selected
    ? mobileTheme.colors.tealSoft
    : mobileTheme.colors.panel,
}))

const CategorySelectButton = styled.Pressable<{ $depth: number }>(
  ({ $depth }) => ({
    minWidth: 0,
    minHeight: 60,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    paddingVertical: mobileTheme.spacing[2],
    paddingLeft: mobileTheme.spacing[3] + ($depth - 1) * 18,
    paddingRight: mobileTheme.spacing[2],
  }),
)

const CategoryMarker = styled.View({
  width: 9,
  height: 9,
  borderRadius: mobileTheme.radii.round,
})

const CategoryCopy = styled.View({ minWidth: 0, flex: 1, gap: 2 })

const CategoryName = styled(AppText)<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  }),
)

const SelectedMark = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 10,
  fontWeight: "600",
})

const ExpandButton = styled.Pressable({
  width: mobileTheme.controls.touch,
  minHeight: mobileTheme.controls.touch,
  alignItems: "center",
  justifyContent: "center",
  borderLeftWidth: 1,
  borderLeftColor: mobileTheme.colors.border,
})

const ExpandSpacer = styled.View({ width: mobileTheme.controls.touch })

const EmptyMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 13,
  lineHeight: 20,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
})
