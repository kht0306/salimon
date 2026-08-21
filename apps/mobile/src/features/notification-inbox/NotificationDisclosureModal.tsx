import styled from "@emotion/native"
import { useState } from "react"
import { Modal, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { mobileTheme } from "../../theme"

interface NotificationDisclosureModalProps {
  busy: boolean
  onAccept: () => void
  onClose: () => void
}

const safeAreaEdges = ["top", "bottom"] as const

export function NotificationDisclosureModal({
  busy,
  onAccept,
  onClose,
}: NotificationDisclosureModalProps) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <Modal
      animationType="slide"
      visible
      onRequestClose={busy ? undefined : onClose}
    >
      <Page
        accessibilityViewIsModal
        edges={safeAreaEdges}
        importantForAccessibility="yes"
        onAccessibilityEscape={busy ? undefined : onClose}
      >
        <Content contentContainerStyle={styles.content}>
          <Eyebrow>선택 기능</Eyebrow>
          <Title accessibilityRole="header">결제 알림 후보함 사용 안내</Title>
          <Description>
            아래 내용을 확인하고 동의한 경우에만 Android 알림 접근 설정을
            엽니다.
          </Description>

          <DisclosureList>
            <DisclosureItem>
              롯데카드처럼 사용자가 선택한 지원 앱의 결제 형태 알림만
              감지합니다.
            </DisclosureItem>
            <DisclosureItem>
              원문은 Android 암호화 저장소에 최대 7일간 보관하며, 제외·전체
              삭제·수집 중지·로그아웃 시 삭제합니다.
            </DisclosureItem>
            <DisclosureItem>
              알림 원문과 확정하지 않은 후보는 살림온 서버로 전송하지 않습니다.
            </DisclosureItem>
            <DisclosureItem>
              동의하지 않거나 권한을 거부해도 수동 거래와 가계부 기능은 그대로
              사용할 수 있습니다.
            </DisclosureItem>
            <DisclosureItem>
              Android 알림 접근 권한 자체는 넓지만, 살림온은 선택한 앱·결제
              문구·금액 조건을 모두 통과한 알림만 저장합니다.
            </DisclosureItem>
          </DisclosureList>

          <ConfirmRow
            accessibilityLabel="위 내용을 이해했으며 알림 감지에 동의합니다."
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed, disabled: busy }}
            disabled={busy}
            onPress={() => setConfirmed((value) => !value)}
          >
            <Checkbox
              $checked={confirmed}
              accessibilityElementsHidden
              allowFontScaling={false}
              importantForAccessibility="no"
            >
              {confirmed ? "✓" : ""}
            </Checkbox>
            <ConfirmText>
              위 내용을 이해했으며 알림 감지에 동의합니다.
            </ConfirmText>
          </ConfirmRow>

          <Actions>
            <AppButton
              disabled={busy || !confirmed}
              label={busy ? "동의 저장 중..." : "동의하고 계속"}
              tone="primary"
              onPress={onAccept}
            />
            <AppButton disabled={busy} label="나중에" onPress={onClose} />
          </Actions>
        </Content>
      </Page>
    </Modal>
  )
}

const Page = styled(SafeAreaView)`
  flex: 1;
  background-color: ${mobileTheme.colors.canvas};
`

const styles = StyleSheet.create({
  content: {
    gap: mobileTheme.spacing[4],
    padding: mobileTheme.spacing[5],
  },
})

const Content = styled.ScrollView``

const Eyebrow = styled(AppText)`
  color: ${mobileTheme.colors.teal};
  font-size: 12px;
  font-weight: 600;
`

const Title = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 28px;
  font-weight: 700;
  line-height: 36px;
`

const Description = styled(AppText)`
  color: ${mobileTheme.colors.muted};
  font-size: 14px;
  line-height: 22px;
`

const DisclosureList = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderColor: mobileTheme.colors.border,
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const DisclosureItem = styled(AppText)`
  color: ${mobileTheme.colors.ink};
  font-size: 13px;
  line-height: 21px;
`

const ConfirmRow = styled.Pressable({
  minHeight: 56,
  flexDirection: "row",
  alignItems: "center",
  gap: mobileTheme.spacing[3],
  borderRadius: mobileTheme.radii.md,
  backgroundColor: mobileTheme.colors.tealSoft,
  padding: mobileTheme.spacing[3],
})

const Checkbox = styled(AppText)<{ $checked: boolean }>(({ $checked }) => ({
  width: 24,
  height: 24,
  borderWidth: 2,
  borderColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.borderStrong,
  borderRadius: mobileTheme.radii.sm,
  backgroundColor: $checked
    ? mobileTheme.colors.teal
    : mobileTheme.colors.panel,
  color: mobileTheme.colors.panel,
  fontSize: 16,
  fontWeight: "600",
  lineHeight: 20,
  textAlign: "center",
}))

const ConfirmText = styled(AppText)`
  flex: 1;
  color: ${mobileTheme.colors.ink};
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
`

const Actions = styled.View({ gap: mobileTheme.spacing[2] })
