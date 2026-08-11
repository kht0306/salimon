import styled from "@emotion/native"
import { observer } from "mobx-react-lite"
import { ScrollView } from "react-native"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"

export const LedgerMonthControls = observer(function LedgerMonthControls() {
  const store = useMobileAppStore()
  const [year, month] = store.selectedMonth.split("-").map(Number)

  return (
    <ControlsPanel>
      <ControlLabel>가계부</ControlLabel>
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

      <MonthRow>
        <MonthButton
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={() => void store.moveSelectedMonth(-1)}
        >
          <MonthButtonLabel>‹</MonthButtonLabel>
        </MonthButton>
        <MonthLabel accessibilityRole="header">
          {year}년 {month}월
        </MonthLabel>
        <MonthButton
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          onPress={() => void store.moveSelectedMonth(1)}
        >
          <MonthButtonLabel>›</MonthButtonLabel>
        </MonthButton>
      </MonthRow>
    </ControlsPanel>
  )
})

const ledgerContentStyle = { gap: 8 } as const

const ControlsPanel = styled.View`
  gap: ${mobileTheme.spacing[3]}px;
  border-width: 1px;
  border-color: ${mobileTheme.colors.border};
  border-radius: ${mobileTheme.radii.md}px;
  background-color: ${mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[4]}px;
`

const ControlLabel = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
  font-weight: 700;
`

const LedgerScroll = styled(ScrollView)`
  flex-grow: 0;
`

const LedgerButton = styled.Pressable<{ $selected: boolean }>`
  min-height: 44px;
  flex-direction: row;
  align-items: center;
  gap: ${mobileTheme.spacing[2]}px;
  border-width: 1px;
  border-color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.borderStrong};
  border-radius: ${mobileTheme.radii.sm}px;
  background-color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.tealSoft : mobileTheme.colors.panel};
  padding: ${mobileTheme.spacing[2]}px ${mobileTheme.spacing[3]}px;
`

const LedgerName = styled.Text<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 700;
`

const DefaultLabel = styled.Text<{ $selected: boolean }>`
  color: ${({ $selected }) =>
    $selected ? mobileTheme.colors.teal : mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 700;
`

const MonthRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`

const MonthButton = styled.Pressable`
  width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${mobileTheme.colors.borderStrong};
  border-radius: ${mobileTheme.radii.sm}px;
  background-color: ${mobileTheme.colors.panel};
`

const MonthButtonLabel = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 28px;
  line-height: 30px;
`

const MonthLabel = styled.Text`
  flex-shrink: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 18px;
  font-weight: 800;
  line-height: 25px;
  text-align: center;
`
