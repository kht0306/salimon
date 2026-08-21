import styled from "@emotion/native"
import type { Transaction } from "@salimon/types"
import { router } from "expo-router"
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
