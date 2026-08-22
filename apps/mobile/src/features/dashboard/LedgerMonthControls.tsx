import styled from "@emotion/native"
import { observer } from "mobx-react-lite"
import { ScrollView } from "react-native"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

export const LedgerMonthControls = observer(function LedgerMonthControls() {
  const store = useMobileAppStore()
  const [year, month] = store.selectedMonth.split("-").map(Number)

  return (
    <ControlsPanel>
      <LedgerSection>
        <ControlLabel>가계부 선택</ControlLabel>
        <LedgerScroll
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ledgerContentStyle}
        >
          {store.selectableLedgers.map((ledger) => {
            const selected = ledger.id === store.selectedLedgerId
            return (
              <LedgerButton
                key={ledger.id}
                $selected={selected}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => store.selectLedger(ledger.id)}
              >
                <LedgerName $selected={selected}>{ledger.name}</LedgerName>
                {store.financeData.members.some(
                  (member) =>
                    member.userId === store.authUser?.id &&
                    member.ledgerId === ledger.id &&
                    member.isDefault,
                ) ? (
                  <DefaultLabel $selected={selected}>기본</DefaultLabel>
                ) : null}
              </LedgerButton>
            )
          })}
        </LedgerScroll>
      </LedgerSection>

      <MonthRow>
        <MonthButton
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={() => void store.moveSelectedMonth(-1)}
        >
          <ChevronLeft
            color={mobileTheme.colors.ink}
            size={20}
            strokeWidth={1.8}
          />
        </MonthButton>
        <MonthLabel accessibilityRole="header">
          {year}년 {month}월
        </MonthLabel>
        <MonthButton
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          onPress={() => void store.moveSelectedMonth(1)}
        >
          <ChevronRight
            color={mobileTheme.colors.ink}
            size={20}
            strokeWidth={1.8}
          />
        </MonthButton>
      </MonthRow>
    </ControlsPanel>
  )
})

const ledgerContentStyle = { gap: 8 } as const

const ControlsPanel = styled.View({ gap: mobileTheme.spacing[3] })

const LedgerSection = styled.View({ gap: mobileTheme.spacing[2] })

const ControlLabel = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 700;
`

const LedgerScroll = styled(ScrollView)`
  flex-grow: 0;
`

const LedgerButton = styled.Pressable<{ $selected: boolean }>(
  ({ $selected }) => ({
    minHeight: mobileTheme.controls.touch,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileTheme.spacing[2],
    borderWidth: 1,
    borderColor: $selected
      ? mobileTheme.colors.teal
      : mobileTheme.colors.border,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: $selected
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panel,
    paddingVertical: mobileTheme.spacing[1],
    paddingHorizontal: mobileTheme.spacing[3],
  }),
)

const LedgerName = styled(AppText)<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 600;
`

const DefaultLabel = styled(AppText)<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 700;
`

const MonthRow = styled.View({
  minHeight: 56,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderTopWidth: 1,
  borderTopColor: mobileTheme.colors.border,
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingVertical: mobileTheme.spacing[1],
})

const MonthButton = styled.Pressable({
  width: 44,
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: mobileTheme.radii.sm,
})

const MonthLabel = styled(AppText)`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 17px;
  font-weight: 600;
  line-height: 25px;
  text-align: center;
`
