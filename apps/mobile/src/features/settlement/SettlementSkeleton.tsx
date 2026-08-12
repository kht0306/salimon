import styled from "@emotion/native"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { mobileTheme } from "../../theme"

const safeAreaEdges = ["top"] as const

export function SettlementSkeleton() {
  return (
    <Page edges={safeAreaEdges}>
      <ScrollView>
        <Content accessibilityLabel="월 정산을 불러오는 중">
          <SkeletonLine $width="28%" />
          <SkeletonLine $width="52%" $height={30} />
          <SkeletonLine $width="78%" />
          <SkeletonPanel $height={112} />
          <SkeletonPanel $dark $height={196} />
          <MetricRow>
            <SkeletonPanel $height={82} />
            <SkeletonPanel $height={82} />
            <SkeletonPanel $height={82} />
          </MetricRow>
          <SkeletonPanel $height={250} />
          <SkeletonPanel $height={220} />
        </Content>
      </ScrollView>
    </Page>
  )
}

const Page = styled(SafeAreaView)({
  flex: 1,
  backgroundColor: mobileTheme.colors.canvas,
})

const Content = styled.View({
  width: "100%",
  maxWidth: 960,
  alignSelf: "center",
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const SkeletonLine = styled.View<{
  $height?: number
  $width: `${number}%`
}>(({ $height = 12, $width }) => ({
  width: $width,
  height: $height,
  borderRadius: mobileTheme.radii.xs,
  backgroundColor: mobileTheme.colors.border,
}))

const SkeletonPanel = styled.View<{ $dark?: boolean; $height: number }>(
  ({ $dark, $height }) => ({
    minWidth: 0,
    flex: 1,
    height: $height,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: $dark ? mobileTheme.colors.ink : mobileTheme.colors.border,
  }),
)

const MetricRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
})
