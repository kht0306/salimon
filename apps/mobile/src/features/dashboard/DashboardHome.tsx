import styled from "@emotion/native"
import type { Transaction } from "@salimon/types"
import { router } from "expo-router"
import { observer } from "mobx-react-lite"
import { FlatList, RefreshControl, useWindowDimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import { DashboardHeader } from "./DashboardHeader"
import { TransactionRow } from "./TransactionRow"

const safeAreaEdges = ["top"] as const
const listContentStyle = { paddingBottom: 24 } as const

export const DashboardHome = observer(function DashboardHome() {
  const store = useMobileAppStore()
  const { width } = useWindowDimensions()

  if (store.dataStatus === "idle" || store.dataStatus === "loading") {
    return <DashboardState message="가계부를 불러오고 있어요." />
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

  function renderTransaction({ item }: { item: Transaction }) {
    return (
      <TransactionRow
        categories={store.financeData.categories}
        transaction={item}
        onPress={() =>
          router.push({
            pathname: "/transactions/[id]",
            params: { id: item.id },
          })
        }
      />
    )
  }

  return (
    <Page edges={safeAreaEdges}>
      <List
        contentContainerStyle={listContentStyle}
        data={store.selectedDateTransactions}
        keyExtractor={(transaction) => transaction.id}
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
        renderItem={renderTransaction}
      />
    </Page>
  )
})

interface DashboardStateProps {
  actionLabel?: string
  message: string
  onAction?: () => void
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

const List = styled(FlatList<Transaction>)`
  width: 100%;
  max-width: 960px;
  align-self: center;
`

const StateContent = styled.View({
  width: "100%",
  maxWidth: 420,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  padding: mobileTheme.spacing[5],
})

const StateText = styled.Text`
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

const EmptyTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
`

const EmptyDescription = styled.Text`
  margin-top: ${mobileTheme.spacing[2]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`
