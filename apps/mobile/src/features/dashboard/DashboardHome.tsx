import styled from "@emotion/native"
import { router } from "expo-router"
import { ChevronDown } from "lucide-react-native"
import { observer } from "mobx-react-lite"
import {
  FlatList,
  RefreshControl,
  type DimensionValue,
  useWindowDimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { DashboardHeader } from "./DashboardHeader"
import { TransactionRow } from "./TransactionRow"
import {
  buildDashboardListItems,
  type DashboardListItem,
} from "./dashboardPresentation"

const safeAreaEdges = ["top"] as const
const listContentStyle = { paddingBottom: 24 } as const

export const DashboardHome = observer(function DashboardHome() {
  const store = useMobileAppStore()
  const { width } = useWindowDimensions()

  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return <DashboardLoading />
  }
  if (store.dataStatus === "error") {
    return (
      <DashboardState
        actionLabel="다시 불러오기"
        message={
          store.dataErrorMessage ?? "가계부 데이터를 불러오지 못했습니다."
        }
        onAction={() => void store.refreshSelectedMonth()}
      />
    )
  }

  const isRefreshing = store.dataStatus === "refreshing"
  const currentMembers = store.financeData.members.filter(
    (member) =>
      member.ledgerId === store.selectedLedgerId && member.status === "active",
  )
  const splitCountsByTransactionId = new Map<string, number>()
  for (const split of store.financeData.transactionSplits) {
    splitCountsByTransactionId.set(
      split.transactionId,
      (splitCountsByTransactionId.get(split.transactionId) ?? 0) + 1,
    )
  }
  const listItems = buildDashboardListItems(
    store.selectedDateTransactions,
    currentMembers,
    store.dashboardTransactionGrouping,
    store.collapsedDashboardTransactionGroupKeys,
  )

  function renderDashboardItem({ item }: { item: DashboardListItem }) {
    if (item.kind === "recurrence") {
      const recurring = item.groupKey === "recurring"
      return (
        <RecurrenceGroupHeader
          $recurring={recurring}
          accessibilityLabel={`${item.label}, ${item.count}건`}
          accessibilityRole="button"
          accessibilityState={{ expanded: !item.collapsed }}
          onPress={() => store.toggleDashboardTransactionGroup(item.groupKey)}
        >
          <RecurrenceGroupLabel $recurring={recurring}>
            {item.label}
          </RecurrenceGroupLabel>
          <GroupHeaderMeta>
            <GroupCount>{item.count}건</GroupCount>
            <ChevronDown
              color={mobileTheme.colors.muted}
              size={16}
              strokeWidth={1.8}
              style={{
                transform: [{ rotate: item.collapsed ? "-90deg" : "0deg" }],
              }}
            />
          </GroupHeaderMeta>
        </RecurrenceGroupHeader>
      )
    }

    if (item.kind === "member") {
      return (
        <MemberGroupHeader
          accessible
          accessibilityLabel={`${item.label}, ${item.count}건`}
        >
          <MemberGroupLabel>{item.label}</MemberGroupLabel>
          <GroupCount>{item.count}건</GroupCount>
        </MemberGroupHeader>
      )
    }

    return (
      <TransactionRow
        categories={store.financeData.categories}
        members={currentMembers}
        splitCount={splitCountsByTransactionId.get(item.transaction.id) ?? 0}
        transaction={item.transaction}
        onPress={() =>
          router.push({
            pathname: "/transactions/[id]",
            params: { id: item.transaction.id },
          })
        }
      />
    )
  }

  return (
    <Page edges={safeAreaEdges}>
      <List
        contentContainerStyle={listContentStyle}
        data={listItems}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          <EmptyState>
            <EmptyTitle>선택한 날짜에 거래가 없습니다.</EmptyTitle>
            <EmptyDescription>
              다른 날짜를 선택하거나 최신 내용을 새로고침해 주세요.
            </EmptyDescription>
          </EmptyState>
        }
        ListHeaderComponent={<DashboardHeader isWide={width >= 720} />}
        refreshControl={
          <RefreshControl
            colors={[mobileTheme.colors.teal]}
            refreshing={isRefreshing}
            tintColor={mobileTheme.colors.teal}
            onRefresh={() => void store.refreshSelectedMonth()}
          />
        }
        renderItem={renderDashboardItem}
      />
    </Page>
  )
})

interface DashboardStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
}

function DashboardLoading() {
  return (
    <Page edges={safeAreaEdges}>
      <LoadingContent accessibilityLabel="가계부를 불러오는 중입니다">
        <LoadingTopRow>
          <LoadingBlock $height={36} $width="42%" />
          <LoadingBlock $height={36} $width="28%" />
        </LoadingTopRow>
        <LoadingBlock $height={52} $width="100%" />
        <LoadingBlock $height={168} $width="100%" />
        <LoadingBlock $height={18} $width="34%" />
        <LoadingBlock $height={110} $width="100%" />
        <LoadingBlock $height={72} $width="100%" />
        <LoadingBlock $height={72} $width="100%" />
      </LoadingContent>
    </Page>
  )
}

function DashboardState({
  actionLabel,
  message,
  onAction,
}: DashboardStateProps) {
  return (
    <Page edges={safeAreaEdges}>
      <StateContent>
        <StateText accessibilityLiveRegion="polite">{message}</StateText>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} onPress={onAction} tone="primary" />
        ) : null}
      </StateContent>
    </Page>
  )
}

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const List = styled(FlatList<DashboardListItem>)`
  width: 100%;
  max-width: 960px;
  align-self: center;
`

const RecurrenceGroupHeader = styled.Pressable<{ $recurring: boolean }>(
  ({ $recurring }) => ({
    minHeight: mobileTheme.controls.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileTheme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: mobileTheme.colors.borderStrong,
    backgroundColor: $recurring
      ? mobileTheme.colors.tealSoft
      : mobileTheme.colors.panelSubtle,
    paddingVertical: mobileTheme.spacing[2],
    paddingHorizontal: mobileTheme.spacing[4],
  }),
)

const RecurrenceGroupLabel = styled(AppText)<{ $recurring: boolean }>`
  color: ${({ $recurring }) =>
    $recurring ? mobileTheme.colors.teal : mobileTheme.colors.ink};
  font-size: 12px;
  font-weight: 700;
`

const GroupHeaderMeta = styled.View({
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[1],
})

const GroupCount = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 10px;
  font-weight: 600;
`

const MemberGroupHeader = styled.View({
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.borderStrong,
  backgroundColor: mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[2],
  paddingHorizontal: mobileTheme.spacing[4],
})

const MemberGroupLabel = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 11px;
  font-weight: 700;
`

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[4],
})

const StateText = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 15px;
  line-height: 23px;
  text-align: center;
`

const EmptyState = styled.View({
  marginHorizontal: mobileTheme.spacing[4],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[5],
})

const EmptyTitle = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 600;
`

const EmptyDescription = styled(AppText)`
  margin-top: ${mobileTheme.spacing[2]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const LoadingContent = styled.View({
  width: "100%",
  maxWidth: 960,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const LoadingTopRow = styled.View({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const LoadingBlock = styled.View<{
  $height: number
  $width: DimensionValue
}>(({ $height, $width }) => ({
  width: $width,
  height: $height,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.border,
}))
