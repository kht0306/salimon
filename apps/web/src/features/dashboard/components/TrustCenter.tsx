"use client"

import styled from "@emotion/styled"
import type { Transaction } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Download,
  FileKey,
  FileUp,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Button, Input, Panel, PanelHeader, PanelTitle } from "../styles"

export const TrustCenter = observer(function TrustCenter() {
  const store = useAppStore()
  const importRef = useRef<HTMLInputElement>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [importing, setImporting] = useState(false)
  const deletionRequest = store.data.accountDeletionRequest

  function exportJson() {
    download(
      `salimon-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          schemaVersion: 1,
          service: "Salimon",
          exportedAt: new Date().toISOString(),
          profile: store.data.profile,
          ledgers: store.data.ledgers,
          members: store.data.members,
          categories: store.data.categories,
          categoryBudgets: store.data.categoryBudgets,
          monthNotes: store.data.monthNotes,
          recurringRules: store.data.recurringRules,
          paymentMethods: store.data.paymentMethods,
          transactions: store.data.transactions,
          transactionSplits: store.data.transactionSplits,
        },
        null,
        2,
      ),
      "application/json",
    )
  }

  function exportCsv() {
    const header = [
      "거래일시",
      "상태",
      "유형",
      "금액",
      "카테고리",
      "가맹점/내용",
      "메모",
      "태그",
      "행위자",
    ]
    const rows = store.data.transactions
      .filter(
        (item) =>
          item.ledgerId === store.selectedLedgerId && !item.deletedAt,
      )
      .map((item) => [
        item.transactionAt,
        item.status === "confirmed" ? "정산 포함" : "정산 제외",
        item.type === "expense" ? "지출" : item.type === "income" ? "수입" : "저축",
        item.amount,
        transactionCategoryLabel(
          store.data.categories,
          store.data.transactionSplits,
          item,
        ),
        item.merchantName ?? "",
        item.memo ?? "",
        (item.tags ?? []).join(", "),
        store.currentMembers.find((member) => member.userId === item.actorUserId)
          ?.nickname ?? (item.actorUserId ? "탈퇴한 멤버" : "공통"),
      ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvCell(String(cell))).join(","))
      .join("\n")
    download(
      `salimon-${store.currentLedger?.name ?? "ledger"}-transactions.csv`,
      `\ufeff${csv}`,
      "text/csv;charset=utf-8",
    )
  }

  async function importBackup(file: File) {
    setImporting(true)
    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("백업 파일은 20MB 이하만 복원할 수 있습니다.")
      }
      const parsed = JSON.parse(await file.text()) as { transactions?: unknown }
      if (!Array.isArray(parsed.transactions)) {
        throw new Error("살림온 백업 파일의 거래 목록을 찾지 못했습니다.")
      }
      if (
        !window.confirm(
          "백업의 거래를 현재 가계부에 복원하시겠습니까? 동일 거래는 자동으로 건너뜁니다.",
        )
      ) {
        return
      }
      await store.importTransactions(parsed.transactions as Transaction[])
    } catch (error) {
      store.notify(
        error instanceof Error ? error.message : "백업 파일을 읽지 못했습니다.",
        "error",
      )
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ""
    }
  }

  return (
    <Stack>
      <Panel>
        <PanelHeader>
          <PanelTitle>개인정보와 데이터</PanelTitle>
        </PanelHeader>
        <TrustSummary>
          <ShieldCheck size={22} />
          <div>
            <strong>공동생활비 기록에 필요한 최소 정보만 관리합니다.</strong>
            <p>
              거래 상세와 카드·계좌 별칭은 암호화 저장하며 전체 카드번호, 계좌번호,
              잔액은 수집하지 않습니다. 영수증 이미지는 AI 분석 후 살림온에 저장하지
              않습니다.
            </p>
            {store.data.legalConsent ? (
              <ConsentRecord>
                필수 문서 {store.data.legalConsent.termsVersion} 동의 · {" "}
                {new Date(store.data.legalConsent.acceptedAt).toLocaleString("ko-KR")}
              </ConsentRecord>
            ) : null}
          </div>
        </TrustSummary>
        <LegalLinks>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <a
            href="https://github.com/kht0306/salimon/issues"
            target="_blank"
            rel="noreferrer"
          >
            문의·권리 행사
          </a>
        </LegalLinks>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>내 데이터 내보내기와 복원</PanelTitle>
        </PanelHeader>
        <ActionBody>
          <p>
            JSON은 전체 계정 백업용이며, CSV는 현재 가계부의 거래 확인용입니다.
            JSON 복원은 백업의 거래를 현재 가계부에 새 거래로 추가하고 중복은
            건너뜁니다.
          </p>
          <ButtonRow>
            <Button type="button" onClick={exportJson}>
              <FileKey size={15} /> 전체 JSON 백업
            </Button>
            <Button type="button" onClick={exportCsv}>
              <Download size={15} /> 현재 가계부 CSV
            </Button>
            <Button
              type="button"
              $variant="soft"
              disabled={importing}
              onClick={() => importRef.current?.click()}
            >
              <FileUp size={15} /> {importing ? "복원 중" : "JSON 거래 복원"}
            </Button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importBackup(file)
              }}
            />
          </ButtonRow>
        </ActionBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>계정 삭제</PanelTitle>
        </PanelHeader>
        <DangerBody>
          {deletionRequest ? (
            <DeletionScheduled role="status">
              <div>
                <strong>계정 삭제가 예약되어 있습니다.</strong>
                <p>
                  {new Date(deletionRequest.purgeAfter).toLocaleString("ko-KR")}
                  에 삭제됩니다. 그 전까지 취소할 수 있습니다.
                </p>
              </div>
              <Button
                type="button"
                $variant="soft"
                onClick={() => void store.cancelAccountDeletion()}
              >
                삭제 요청 취소
              </Button>
            </DeletionScheduled>
          ) : (
            <>
              <p>
                요청 후 7일 동안 복구할 수 있으며 이후 로그인 계정과 개인 가계부는
                삭제됩니다. 공동 가계부에 남긴 거래는 다른 멤버의 정산 기록 보호를
                위해 작성자만 익명화하여 유지됩니다. 다른 멤버가 있는 공동 가계부의
                소유자는 먼저 소유권을 이전해야 합니다.
              </p>
              <DeleteForm>
                <Input
                  value={deleteConfirmation}
                  placeholder="계정삭제 입력"
                  aria-label="계정 삭제 확인 문구"
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
                <Button
                  type="button"
                  $variant="danger"
                  disabled={deleteConfirmation !== "계정삭제"}
                  onClick={() => {
                    if (
                      window.confirm(
                        "계정 삭제를 예약하시겠습니까? 7일 뒤 되돌릴 수 없습니다.",
                      )
                    ) {
                      void store.requestAccountDeletion().then((requested) => {
                        if (requested) setDeleteConfirmation("")
                      })
                    }
                  }}
                >
                  <Trash2 size={15} /> 7일 후 계정 삭제
                </Button>
              </DeleteForm>
            </>
          )}
        </DangerBody>
      </Panel>
    </Stack>
  )
})

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string) {
  return `"${spreadsheetSafeText(value).replaceAll('"', '""')}"`
}

function spreadsheetSafeText(value: string) {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
}

function transactionCategoryLabel(
  categories: Array<{ id: string; name: string; parentCategoryId?: string }>,
  splits: Array<{ transactionId: string; categoryId: string; amount: number }>,
  transaction: Transaction,
) {
  const label = (categoryId?: string) => {
    const category = categories.find((item) => item.id === categoryId)
    const parent = category?.parentCategoryId
      ? categories.find((item) => item.id === category.parentCategoryId)
      : undefined
    return category ? `${parent ? `${parent.name} › ` : ""}${category.name}` : "기타"
  }
  const transactionSplits = splits.filter(
    (split) => split.transactionId === transaction.id,
  )
  return transactionSplits.length > 0
    ? transactionSplits
        .map((split) => `${label(split.categoryId)} ${split.amount}원`)
        .join(" / ")
    : label(transaction.categoryId)
}

const Stack = styled.div`display: grid; gap: 16px;`
const TrustSummary = styled.div`
  display: flex;
  gap: 12px;
  padding: 18px;
  svg { flex: 0 0 auto; color: ${colors.teal}; }
  p { margin: 5px 0 0; color: ${colors.muted}; font-size: 12px; }
`
const LegalLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid ${colors.border};
  padding: 12px 18px;
  a {
    border: 1px solid ${colors.border};
    border-radius: ${radii.sm};
    padding: 7px 10px;
    font-size: 12px;
    text-decoration: none;
  }
`
const ConsentRecord = styled.small`
  display: block;
  margin-top: 7px;
  color: ${colors.muted};
  font-size: 10px;
`
const ActionBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 18px;
  p { margin: 0; color: ${colors.muted}; font-size: 12px; }
`
const ButtonRow = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`
const DangerBody = styled(ActionBody)`
  border-left: 3px solid ${colors.coral};
`
const DeleteForm = styled.div`
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto;
  gap: 8px;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`
const DeletionScheduled = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  p { margin-top: 4px; }
  @media (max-width: 560px) { align-items: stretch; flex-direction: column; }
`
