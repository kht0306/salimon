import styled from "@emotion/native"
import type { ReceiptParseResult } from "@salimon/types"
import { useState } from "react"
import { Switch } from "react-native"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"
import { selectAndParseReceipt, type ReceiptImageSource } from "./receiptClient"

interface ReceiptImportPanelProps {
  disabled?: boolean
  onApply: (result: ReceiptParseResult) => void
}

export function ReceiptImportPanel({
  disabled = false,
  onApply,
}: ReceiptImportPanelProps) {
  const [consented, setConsented] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>()

  async function selectReceipt(source: ReceiptImageSource): Promise<void> {
    if (!consented) {
      setError("AI 데이터 사용 안내를 확인해 주세요.")
      return
    }
    setProcessing(true)
    setError(undefined)
    try {
      const result = await selectAndParseReceipt(source)
      if (result) onApply(result)
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "영수증을 인식하지 못했습니다.",
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Panel>
      <Title>영수증 AI 초안</Title>
      <Description>
        카메라나 사진에서 금액·가맹점·일시를 읽어 아래 입력란을 채웁니다. 자동
        저장되지 않으므로 반드시 내용을 확인해 주세요.
      </Description>
      <ConsentRow>
        <ConsentCopy>
          이미지는 저장하지 않고 분석 후 폐기합니다. 무료 Gemini 키는 Google의
          제품 개선·사람 검토에 사용될 수 있습니다. 개인정보가 있는 영수증은
          첨부하지 않으며, 사진 메타데이터 제거 후 전송하는 데 동의합니다.
        </ConsentCopy>
        <Switch
          accessibilityLabel="영수증 AI 데이터 사용 동의"
          disabled={processing}
          value={consented}
          onValueChange={setConsented}
        />
      </ConsentRow>
      <ButtonRow>
        <ButtonCell>
          <AppButton
            disabled={disabled || processing || !consented}
            label={processing ? "분석 중..." : "카메라 촬영"}
            tone="secondary"
            onPress={() => void selectReceipt("camera")}
          />
        </ButtonCell>
        <ButtonCell>
          <AppButton
            disabled={disabled || processing || !consented}
            label={processing ? "분석 중..." : "사진에서 선택"}
            tone="secondary"
            onPress={() => void selectReceipt("library")}
          />
        </ButtonCell>
      </ButtonRow>
      {error ? <ErrorText accessibilityRole="alert">{error}</ErrorText> : null}
    </Panel>
  )
}

const Panel = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.teal,
  backgroundColor: mobileTheme.colors.tealSoft,
  padding: mobileTheme.spacing[4],
})

const Title = styled(AppText)({
  color: mobileTheme.colors.teal,
  fontSize: 14,
  fontWeight: "700",
})

const Description = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})

const ConsentRow = styled.View({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: mobileTheme.spacing[3],
})

const ConsentCopy = styled(AppText)({
  minWidth: 0,
  flex: 1,
  color: mobileTheme.colors.muted,
  fontSize: 9,
  lineHeight: 14,
})

const ButtonRow = styled.View({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: mobileTheme.spacing[2],
})

const ButtonCell = styled.View({ minWidth: 150, flex: 1 })

const ErrorText = styled(AppText)({
  color: mobileTheme.colors.coral,
  fontSize: 10,
  lineHeight: 15,
})
