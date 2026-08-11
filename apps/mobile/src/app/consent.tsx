import styled from "@emotion/native"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@salimon/types"
import { Redirect } from "expo-router"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../components/AppButton"
import { openLegalDocument } from "../features/auth/legalDocuments"
import { useMobileAppStore } from "../stores/MobileStoreProvider"
import { mobileTheme } from "../theme"

const safeAreaEdges = ["top", "bottom"] as const
const scrollContentStyle = { flexGrow: 1 } as const

export default observer(function LegalConsentScreen() {
  const store = useMobileAppStore()
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [documentError, setDocumentError] = useState<string>()

  if (store.authState === "anonymous") {
    return <Redirect href="./auth/login" />
  }
  if (store.dataStatus !== "ready" || !store.requiresLegalConsent) {
    return <Redirect href="/" />
  }

  const isSaving = store.consentStatus === "saving"
  const canSubmit = termsChecked && privacyChecked && !isSaving

  async function openDocument(path: "/privacy" | "/terms"): Promise<void> {
    setDocumentError(undefined)
    try {
      await openLegalDocument(path)
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : "필수 문서를 열지 못했습니다.",
      )
    }
  }

  return (
    <Page edges={safeAreaEdges}>
      <PageScroll contentContainerStyle={scrollContentStyle}>
        <Content>
          <Eyebrow>필수 동의</Eyebrow>
          <Title accessibilityRole="header">
            살림온 이용 전 확인해 주세요.
          </Title>
          <Description>
            공동생활비 기록과 정산을 위해 이용약관과 개인정보 처리방침 동의가
            필요합니다.
          </Description>

          <ConsentCard>
            <ConsentOption
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsChecked }}
              onPress={() => setTermsChecked((checked) => !checked)}
            >
              <Checkbox $checked={termsChecked}>
                <Checkmark>{termsChecked ? "✓" : ""}</Checkmark>
              </Checkbox>
              <ConsentCopy>
                <ConsentTitle>[필수] 이용약관 동의</ConsentTitle>
                <ConsentDescription>
                  버전 {CURRENT_TERMS_VERSION}에 동의합니다.
                </ConsentDescription>
              </ConsentCopy>
            </ConsentOption>
            <DocumentLink
              accessibilityRole="link"
              onPress={() => void openDocument("/terms")}
            >
              이용약관 전문 열기
            </DocumentLink>
          </ConsentCard>

          <ConsentCard>
            <ConsentOption
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyChecked }}
              onPress={() => setPrivacyChecked((checked) => !checked)}
            >
              <Checkbox $checked={privacyChecked}>
                <Checkmark>{privacyChecked ? "✓" : ""}</Checkmark>
              </Checkbox>
              <ConsentCopy>
                <ConsentTitle>[필수] 개인정보 처리방침 동의</ConsentTitle>
                <ConsentDescription>
                  버전 {CURRENT_PRIVACY_VERSION}에 동의합니다.
                </ConsentDescription>
              </ConsentCopy>
            </ConsentOption>
            <DocumentLink
              accessibilityRole="link"
              onPress={() => void openDocument("/privacy")}
            >
              개인정보 처리방침 전문 열기
            </DocumentLink>
          </ConsentCard>

          <Notice>
            동의 시각과 문서 버전만 기록하며, IP 주소나 기기 식별정보를 동의
            증명 목적으로 추가 수집하지 않습니다.
          </Notice>
          {(documentError ?? store.consentErrorMessage) ? (
            <ErrorText accessibilityLiveRegion="polite">
              {documentError ?? store.consentErrorMessage}
            </ErrorText>
          ) : null}

          <Actions>
            <AppButton
              disabled={isSaving}
              label="로그아웃"
              onPress={() => void store.logout()}
            />
            <AppButton
              disabled={!canSubmit}
              label={isSaving ? "동의 기록 중..." : "동의하고 시작하기"}
              onPress={() => void store.acceptLegalTerms()}
              tone="primary"
            />
          </Actions>
        </Content>
      </PageScroll>
    </Page>
  )
})

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const PageScroll = styled.ScrollView`
  flex: 1;
`

const Content = styled.View({
  width: "100%",
  maxWidth: 560,
  alignSelf: "center",
  flex: 1,
  justifyContent: "center",
  gap: mobileTheme.spacing[3],
  paddingVertical: mobileTheme.spacing[6],
  paddingHorizontal: mobileTheme.spacing[5],
})

const Eyebrow = styled.Text`
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
`

const Title = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 26px;
  font-weight: 800;
  line-height: 34px;
`

const Description = styled.Text`
  margin-bottom: ${mobileTheme.spacing[2]}px;
  color: ${mobileTheme.colors.muted};
  font-size: 14px;
  line-height: 21px;
`

const ConsentCard = styled.View({
  gap: mobileTheme.spacing[2],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const ConsentOption = styled.Pressable({
  minHeight: 44,
  flexDirection: "row",
  alignItems: "flex-start",
  gap: mobileTheme.spacing[3],
})

const Checkbox = styled.View<{ $checked: boolean }>(({ $checked }) => ({
  width: 22,
  height: 22,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.xs,
  backgroundColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.panel,
}))

const Checkmark = styled.Text`
  color: ${mobileTheme.colors.panel};
  font-size: 15px;
  font-weight: 800;
`

const ConsentCopy = styled.View`
  flex: 1;
`

const ConsentTitle = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
`

const ConsentDescription = styled.Text`
  margin-top: 2px;
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 18px;
`

const DocumentLink = styled.Text`
  min-height: 32px;
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 700;
  line-height: 32px;
`

const Notice = styled.Text`
  color: ${mobileTheme.colors.muted};
  font-size: 11px;
  line-height: 17px;
`

const ErrorText = styled.Text({
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: mobileTheme.colors.coralSoft,
  color: mobileTheme.colors.coral,
  fontSize: 12,
  lineHeight: 18,
  padding: mobileTheme.spacing[3],
})

const Actions = styled.View({
  gap: mobileTheme.spacing[2],
  marginTop: mobileTheme.spacing[2],
})
