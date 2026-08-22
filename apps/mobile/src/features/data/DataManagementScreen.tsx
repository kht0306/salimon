import styled from "@emotion/native"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { Alert } from "react-native"
import { AppButton } from "../../components/AppButton"
import { AppText } from "../../components/AppText"
import { openLegalDocument } from "../auth/legalDocuments"
import { useMobileAppStore } from "../../stores/MobileStoreProvider"
import { mobileTheme } from "../../theme"
import {
  ErrorText,
  Field,
  FieldLabel,
  InlineRow,
  Input,
  ManagementScaffold,
  NoticeText,
  SectionCard,
  SectionDescription,
  SectionTitle,
  TextButton,
  TextButtonLabel,
} from "../management/ManagementUI"
import {
  createFullBackupJson,
  createLedgerTransactionsCsv,
  parseBackupTransactionsJson,
  safeDataFilename,
} from "./dataExport"
import { pickBackupJson, shareDataFile } from "./mobileDataFiles"

export const DataManagementScreen = observer(function DataManagementScreen() {
  const store = useMobileAppStore()
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [localError, setLocalError] = useState<string>()
  const busy = store.dataToolState === "working"
  const deletionRequest = store.financeData.accountDeletionRequest

  useEffect(() => {
    store.clearDataToolFeedback()
  }, [store])

  async function exportJson(): Promise<void> {
    setLocalError(undefined)
    const data = await store.loadFullFinanceDataForExport()
    if (!data) return
    try {
      await shareDataFile({
        content: createFullBackupJson(data),
        dialogTitle: "살림온 전체 JSON 백업",
        filename:
          "salimon-backup-" + new Date().toISOString().slice(0, 10) + ".json",
        mimeType: "application/json",
      })
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "백업 파일을 공유하지 못했습니다.",
      )
    }
  }

  async function exportCsv(): Promise<void> {
    setLocalError(undefined)
    const data = await store.loadFullFinanceDataForExport()
    if (!data || !store.currentLedger) return
    try {
      await shareDataFile({
        content: createLedgerTransactionsCsv(data, store.currentLedger.id),
        dialogTitle: "현재 가계부 거래 CSV",
        filename:
          "salimon-" +
          safeDataFilename(store.currentLedger.name) +
          "-transactions.csv",
        mimeType: "text/csv",
      })
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "CSV 파일을 공유하지 못했습니다.",
      )
    }
  }

  async function selectBackup(): Promise<void> {
    setLocalError(undefined)
    try {
      const content = await pickBackupJson()
      if (!content) return
      const transactions = parseBackupTransactionsJson(content)
      Alert.alert(
        "거래를 복원할까요?",
        "백업의 거래를 현재 가계부에 추가합니다. 같은 유형·금액·일시·가맹점의 거래는 건너뜁니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "복원",
            onPress: () => void store.importBackupTransactions(transactions),
          },
        ],
      )
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "백업 파일을 읽지 못했습니다.",
      )
    }
  }

  function confirmDeletion(): void {
    Alert.alert(
      "계정 삭제를 예약할까요?",
      "7일 뒤에는 되돌릴 수 없습니다. 공동 가계부의 소유자는 먼저 소유권을 이전해야 합니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제 예약",
          style: "destructive",
          onPress: () =>
            void store.requestAccountDeletion().then((requested) => {
              if (requested) setDeleteConfirmation("")
            }),
        },
      ],
    )
  }

  async function openLegal(path: "/privacy" | "/terms"): Promise<void> {
    setLocalError(undefined)
    try {
      await openLegalDocument(path)
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "문서를 열지 못했습니다.",
      )
    }
  }

  return (
    <ManagementScaffold
      description="계정 전체 백업과 현재 가계부 거래 내보내기, 복원, 계정 삭제 일정을 관리합니다."
      title="개인정보·데이터"
    >
      {localError || store.dataToolErrorMessage ? (
        <ErrorText accessibilityRole="alert">
          {localError ?? store.dataToolErrorMessage}
        </ErrorText>
      ) : null}
      {store.dataToolNoticeMessage ? (
        <NoticeText accessibilityLiveRegion="polite">
          {store.dataToolNoticeMessage}
        </NoticeText>
      ) : null}

      <SectionCard>
        <SectionTitle>개인정보 보호</SectionTitle>
        <SectionDescription>
          거래 상세와 카드·계좌 별칭만 저장하며 전체 카드번호, 계좌번호, 잔액은
          수집하지 않습니다. 영수증 이미지는 AI 분석 후 살림온에 저장하지
          않습니다.
        </SectionDescription>
        <InlineRow>
          <TextButton onPress={() => void openLegal("/privacy")}>
            <TextButtonLabel>개인정보 처리방침</TextButtonLabel>
          </TextButton>
          <TextButton onPress={() => void openLegal("/terms")}>
            <TextButtonLabel>이용약관</TextButtonLabel>
          </TextButton>
        </InlineRow>
      </SectionCard>

      <SectionCard>
        <SectionTitle>내보내기와 복원</SectionTitle>
        <SectionDescription>
          JSON은 전체 계정 백업이며 CSV는 현재 가계부의 모든 거래 확인용입니다.
          JSON 복원은 최대 2,000건을 추가하고 중복 거래는 건너뜁니다.
        </SectionDescription>
        <AppButton
          disabled={busy}
          label={busy ? "데이터 준비 중..." : "전체 JSON 백업 공유"}
          onPress={() => void exportJson()}
        />
        <AppButton
          disabled={busy}
          label={busy ? "데이터 준비 중..." : "현재 가계부 CSV 공유"}
          onPress={() => void exportCsv()}
        />
        <AppButton
          disabled={busy || !store.canMutateCurrentLedger}
          label={busy ? "처리 중..." : "JSON 거래 복원"}
          tone="primary"
          onPress={() => void selectBackup()}
        />
      </SectionCard>

      <DangerCard>
        <SectionTitle>계정 삭제</SectionTitle>
        {deletionRequest ? (
          <>
            <DangerDescription>
              계정 삭제가 예약되어 있습니다.{" "}
              {new Date(deletionRequest.purgeAfter).toLocaleString("ko-KR")}에
              삭제되며 그 전까지 취소할 수 있습니다.
            </DangerDescription>
            <AppButton
              disabled={busy}
              label={busy ? "처리 중..." : "삭제 요청 취소"}
              onPress={() => void store.cancelAccountDeletion()}
            />
          </>
        ) : (
          <>
            <DangerDescription>
              요청 후 7일 동안 취소할 수 있습니다. 이후 로그인 계정과 개인
              가계부는 삭제되고, 공동 정산 기록은 작성자만 익명화하여
              유지됩니다.
            </DangerDescription>
            <Field>
              <FieldLabel>확인 문구</FieldLabel>
              <Input
                accessibilityLabel="계정 삭제 확인 문구"
                placeholder="계정삭제 입력"
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
              />
            </Field>
            <TextButton
              $danger
              disabled={busy || deleteConfirmation !== "계정삭제"}
              onPress={confirmDeletion}
            >
              <TextButtonLabel $danger>7일 후 계정 삭제</TextButtonLabel>
            </TextButton>
          </>
        )}
      </DangerCard>
    </ManagementScaffold>
  )
})

const DangerCard = styled.View({
  gap: mobileTheme.spacing[3],
  borderWidth: 1,
  borderLeftWidth: 3,
  borderColor: mobileTheme.colors.coral,
  backgroundColor: mobileTheme.colors.panel,
  padding: mobileTheme.spacing[4],
})

const DangerDescription = styled(AppText)({
  color: mobileTheme.colors.muted,
  fontSize: 11,
  lineHeight: 17,
})
