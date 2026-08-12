import styled from "@emotion/native"
import { useEffect, useState } from "react"
import { Animated, ScrollView } from "react-native"
import { mobileTheme } from "../../theme"

const scrollContentStyle = { paddingBottom: mobileTheme.spacing[6] } as const
const rowWidths = ["72%", "56%", "82%", "64%", "76%"] as const

export function TransactionsSkeleton() {
  const [opacity] = useState(() => new Animated.Value(0.48))

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 720,
          toValue: 0.88,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 720,
          toValue: 0.48,
          useNativeDriver: true,
        }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [opacity])

  return (
    <ScrollView
      accessible
      accessibilityLabel="거래 내역을 불러오는 중"
      accessibilityLiveRegion="polite"
      contentContainerStyle={scrollContentStyle}
      pointerEvents="none"
      showsVerticalScrollIndicator={false}
    >
      <AnimatedContent style={{ opacity }}>
        <Header>
          <HeadingRow>
            <HeadingCopy>
              <SkeletonBlock $height={10} $width="30%" />
              <SkeletonBlock $height={30} $width="48%" />
              <SkeletonBlock $height={14} $width="76%" />
            </HeadingCopy>
            <SkeletonBlock $height={34} $radius={17} $width={54} />
          </HeadingRow>

          <MonthControl>
            <SkeletonBlock $height={28} $radius={14} $width={28} />
            <SkeletonBlock $height={20} $width="34%" />
            <SkeletonBlock $height={28} $radius={14} $width={28} />
          </MonthControl>

          <SearchRow>
            <SkeletonBlock $flex $height={46} />
            <SkeletonBlock $height={46} $width={76} />
          </SearchRow>

          <TotalsCard>
            <TotalSkeleton>
              <SkeletonLight $height={9} $width="46%" />
              <SkeletonLight $height={16} $width="78%" />
            </TotalSkeleton>
            <TotalSkeleton>
              <SkeletonLight $height={9} $width="46%" />
              <SkeletonLight $height={16} $width="78%" />
            </TotalSkeleton>
            <TotalSkeleton>
              <SkeletonLight $height={9} $width="46%" />
              <SkeletonLight $height={16} $width="78%" />
            </TotalSkeleton>
          </TotalsCard>
        </Header>

        <DateHeaderSkeleton>
          <SkeletonBlock $height={18} $width="32%" />
          <SkeletonBlock $height={14} $width="20%" />
        </DateHeaderSkeleton>

        {rowWidths.map((width, index) => (
          <RowSkeleton key={`${width}-${index}`}>
            <SkeletonBlock $height={36} $radius={18} $width={36} />
            <RowCopy>
              <SkeletonBlock $height={14} $width={width} />
              <SkeletonBlock $height={10} $width="88%" />
            </RowCopy>
            <SkeletonBlock $height={15} $width={72} />
          </RowSkeleton>
        ))}
      </AnimatedContent>
    </ScrollView>
  )
}

const AnimatedContent = styled(Animated.View)({ width: "100%" })

const Header = styled.View({
  gap: mobileTheme.spacing[4],
  padding: mobileTheme.spacing[4],
})

const HeadingRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[3],
})

const HeadingCopy = styled.View({ flex: 1, gap: mobileTheme.spacing[2] })

const MonthControl = styled.View({
  minHeight: 56,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  paddingHorizontal: mobileTheme.spacing[4],
})

const SearchRow = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[2],
})

const TotalsCard = styled.View({
  flexDirection: "row",
  gap: mobileTheme.spacing[3],
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.ink,
  padding: mobileTheme.spacing[4],
})

const TotalSkeleton = styled.View({ flex: 1, gap: mobileTheme.spacing[2] })

const DateHeaderSkeleton = styled.View({
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  paddingHorizontal: mobileTheme.spacing[4],
})

const RowSkeleton = styled.View({
  minHeight: 72,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  borderBottomWidth: 1,
  borderBottomColor: mobileTheme.colors.border,
  backgroundColor: mobileTheme.colors.panel,
  paddingVertical: mobileTheme.spacing[3],
  paddingHorizontal: mobileTheme.spacing[4],
})

const RowCopy = styled.View({ flex: 1, gap: mobileTheme.spacing[2] })

const SkeletonBlock = styled.View<{
  $flex?: boolean
  $height: number
  $radius?: number
  $width?: number | `${number}%`
}>(({ $flex, $height, $radius = mobileTheme.radii.xs, $width }) => ({
  height: $height,
  flex: $flex ? 1 : undefined,
  width: $width,
  borderRadius: $radius,
  backgroundColor: mobileTheme.colors.border,
}))

const SkeletonLight = styled(SkeletonBlock)({
  backgroundColor: mobileTheme.colors.borderStrong,
})
