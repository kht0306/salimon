import { useTheme } from "@emotion/react"
import styled from "@emotion/native"
import { useMemo, useState } from "react"
import { FlatList, Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

export interface TransactionOption {
  color?: string
  description?: string
  groupLabel?: string
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
  const theme = useTheme()
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
            placeholderTextColor={theme.colors.subtle}
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
            renderItem={({ item, index }) => {
              const selected = item.id === selectedId
              const showGroupLabel =
                Boolean(item.groupLabel) &&
                item.groupLabel !== filteredOptions[index - 1]?.groupLabel
              return (
                <OptionGroup>
                  {showGroupLabel ? (
                    <OptionGroupLabel>{item.groupLabel}</OptionGroupLabel>
                  ) : null}
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
                </OptionGroup>
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
    height: "74%",
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
  minHeight: 64,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const SheetTitle = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 20,
  fontWeight: "700",
}))

const CloseButton = styled.Pressable({
  minWidth: 52,
  minHeight: mobileTheme.controls.touch,
  alignItems: "flex-end",
  justifyContent: "center",
})

const CloseButtonLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.teal,
  fontSize: 13,
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
  fontSize: 14,
  paddingHorizontal: mobileTheme.spacing[4],
  marginBottom: mobileTheme.spacing[3],
}))

const OptionList = styled(FlatList<TransactionOption>)({ flex: 1 })

const OptionGroup = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.panel,
}))

const OptionGroupLabel = styled(AppText)(({ theme }) => ({
  minHeight: 32,
  color: theme.colors.muted,
  fontSize: 11,
  fontWeight: "700",
  lineHeight: 32,
  paddingHorizontal: mobileTheme.spacing[3],
  backgroundColor: theme.colors.panelSubtle,
}))

const OptionButton = styled.Pressable<{ $selected: boolean }>(
  ({ theme, $selected }) => ({
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: $selected ? theme.colors.tealSoft : theme.colors.panel,
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
  ({ theme, $selected }) => ({
    color: $selected ? theme.colors.teal : theme.colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  }),
)

const OptionDescription = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 10,
  lineHeight: 15,
}))

const SelectedMark = styled(AppText)(({ theme }) => ({
  color: theme.colors.teal,
  fontSize: 10,
  fontWeight: "600",
}))

const EmptyMessage = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 13,
  lineHeight: 20,
  textAlign: "center",
  paddingVertical: mobileTheme.spacing[8],
}))
