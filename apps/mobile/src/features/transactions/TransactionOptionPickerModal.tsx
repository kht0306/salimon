import styled from "@emotion/native"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

export interface TransactionOption {
  color?: string
  description?: string
  id: string
  label: string
}

interface TransactionOptionPickerModalProps {
  clearLabel?: string
  emptyMessage: string
  options: TransactionOption[]
  selectedId: string
  title: string
  onClose: () => void
  onSelect: (id: string) => void
}

const safeAreaEdges = ["bottom"] as const

export function TransactionOptionPickerModal({
  clearLabel,
  emptyMessage,
  options,
  selectedId,
  title,
  onClose,
  onSelect,
}: TransactionOptionPickerModalProps) {
  const [query, setQuery] = useState("")
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")
    if (!normalizedQuery) return options
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery),
    )
  }, [options, query])

  function select(id: string): void {
    onSelect(id)
    onClose()
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

          <SearchInput
            accessibilityLabel={`${title} 검색`}
            autoCorrect={false}
            placeholder="이름 검색"
            placeholderTextColor={mobileTheme.colors.subtle}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />

          <OptionList
            contentContainerStyle={styles.listContent}
            data={filteredOptions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.id}
            ListEmptyComponent={<EmptyMessage>{emptyMessage}</EmptyMessage>}
            ListHeaderComponent={
              clearLabel ? (
                <OptionButton
                  $selected={!selectedId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !selectedId }}
                  onPress={() => select("")}
                >
                  <OptionCopy>
                    <OptionLabel $selected={!selectedId}>
                      {clearLabel}
                    </OptionLabel>
                  </OptionCopy>
                  {!selectedId ? <SelectedMark>선택</SelectedMark> : null}
                </OptionButton>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = item.id === selectedId
              return (
                <OptionButton
                  $selected={selected}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => select(item.id)}
                >
                  {item.color ? (
                    <OptionMarker style={{ backgroundColor: item.color }} />
                  ) : null}
                  <OptionCopy>
                    <OptionLabel $selected={selected} numberOfLines={2}>
                      {item.label}
                    </OptionLabel>
                    {item.description ? (
                      <OptionDescription numberOfLines={2}>
                        {item.description}
                      </OptionDescription>
                    ) : null}
                  </OptionCopy>
                  {selected ? <SelectedMark>선택</SelectedMark> : null}
                </OptionButton>
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
  height: "74%",
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
  minHeight: 64,
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
  minHeight: 40,
  alignItems: "flex-end",
  justifyContent: "center",
})

const CloseButtonLabel = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 13,
  fontWeight: "600",
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

const OptionList = styled(FlatList<TransactionOption>)({ flex: 1 })

const OptionButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: 64,
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

const OptionMarker = styled.View({
  width: 9,
  height: 9,
  borderRadius: mobileTheme.radii.round,
})

const OptionCopy = styled.View({ minWidth: 0, flex: 1, gap: 2 })

const OptionLabel = styled(AppText)<{ $selected: boolean }>(
  ({ $selected }) => ({
    color: $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  }),
)

const OptionDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
})

const SelectedMark = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 10,
  fontWeight: "600",
})

const EmptyMessage = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 13,
  lineHeight: 20,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
})
