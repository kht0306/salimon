import styled from "@emotion/native"
import {
  buildInstallmentSchedulePreview,
  formatKoreanDate,
} from "@salimon/domain"
import type { PaymentMethod } from "@salimon/types"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

interface InstallmentSchedulePreviewProps {
  installmentMonths: string
  isConversion?: boolean
  paymentMethod?: PaymentMethod
  purchaseDate: string
}

export function InstallmentSchedulePreview({
  installmentMonths,
  isConversion = false,
  paymentMethod,
  purchaseDate,
}: InstallmentSchedulePreviewProps) {
  const schedule = buildInstallmentSchedulePreview({
    installmentMonths: Number(installmentMonths),
    paymentDay: paymentMethod?.paymentDay,
    purchaseDate,
    billingCycle: isConversion
      ? {
          endDay: paymentMethod?.billingPeriodEndDay,
          endMonthOffset: paymentMethod?.billingPeriodEndMonthOffset,
        }
      : undefined,
  })
  if (schedule.length === 0) return null
  const summary =
    schedule.length <= 4
      ? schedule
      : schedule.filter(
          (_, index) => index < 3 || index === schedule.length - 1,
        )

  return (
    <Preview>
      <Title accessibilityRole="header">할부 일정</Title>
      <Description>
        {isConversion
          ? "일반 거래의 할부 전환은 카드 이용기간과 결제일을 기준으로 반영합니다."
          : "1회차는 구매일에 반영하고, 다음 달부터 카드 결제일에 반영합니다."}
      </Description>
      {summary.map((item, index) => (
        <ScheduleItem key={item.installmentNumber}>
          <ScheduleRow>
            <Copy>
              <NumberLabel>
                {item.installmentNumber}/{installmentMonths}회
              </NumberLabel>
              <Description>
                {!isConversion && item.installmentNumber === 1
                  ? "구매일 반영"
                  : "카드 결제 예정"}
              </Description>
            </Copy>
            <DateLabel>{formatKoreanDate(item.date)}</DateLabel>
          </ScheduleRow>
          {index === 2 && schedule.length > 4 ? (
            <Description>중간 회차 생략</Description>
          ) : null}
        </ScheduleItem>
      ))}
    </Preview>
  )
}

const Preview = styled.View(({ theme }) => ({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: theme.colors.panelSubtle,
  padding: mobileTheme.spacing[3],
}))
const Title = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  ...mobileTheme.typography.label,
}))
const Description = styled(AppText)(({ theme }) => ({
  color: theme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
}))
const ScheduleItem = styled.View({ gap: mobileTheme.spacing[2] })
const ScheduleRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: mobileTheme.spacing[2],
})
const Copy = styled.View({ gap: mobileTheme.spacing[1] })
const NumberLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 12,
  fontWeight: "600",
}))
const DateLabel = styled(AppText)(({ theme }) => ({
  color: theme.colors.ink,
  fontSize: 13,
  fontWeight: "600",
}))
