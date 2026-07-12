"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import type { SmsCandidateStatus } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import {
  Archive,
  Bell,
  CheckCircle2,
  Clock3,
  SearchCheck,
  XCircle,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  Panel,
  PanelHeader,
  PanelTitle,
  Textarea,
} from "../styles"

const example = "[카드사] 06/28 12:34 스타벅스 5,800원 승인"
const examples = [
  { label: "국민카드", value: "[국민카드] 06/28 12:34 5,800원 스타벅스 승인" },
  { label: "체크카드", value: "체크카드 15,000원 사용 CU편의점" },
  { label: "현대카드", value: "현대카드 일시불 승인 23,400원 쿠팡" },
]
const statusLabels: Record<SmsCandidateStatus, string> = {
  detected: "감지됨",
  notified: "알림",
  deferred: "보류",
  opened: "확인 중",
  registered: "등록됨",
  ignored: "제외됨",
  auto_registered_other: "기타 등록",
  needs_review: "검토 필요",
}

export const SmsCandidatePanel = observer(function SmsCandidatePanel() {
  const store = useAppStore()
  const [rawText, setRawText] = useState(example)

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>미등록 카드 문자</PanelTitle>
        <Button
          $variant="primary"
          disabled={!rawText.trim()}
          onClick={() => store.detectSmsCandidate(rawText)}
        >
          <Bell size={16} /> 감지
        </Button>
      </PanelHeader>

      <Composer>
        <Field>
          테스트 문자
          <Textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />
        </Field>
      </Composer>

      <CandidateList>
        {store.deferredSmsCandidates.map((candidate) => (
          <Candidate key={candidate.id}>
            <CandidateTop>
              <SearchCheck size={18} />
              <div>
                <strong>
                  {candidate.parsed.merchantName || "카드 사용 후보"}
                </strong>
                <Meta>
                  {formatKrw(candidate.parsed.amount)} · 신뢰도{" "}
                  {Math.round(candidate.parsed.confidence * 100)}%
                </Meta>
              </div>
              <Status>{statusLabels[candidate.status]}</Status>
            </CandidateTop>
            <Masked>{candidate.maskedMessage}</Masked>
            <Actions>
              <Button
                $variant="primary"
                onClick={() => void store.registerSmsCandidate(candidate.id)}
              >
                <CheckCircle2 size={15} /> 기타 등록
              </Button>
              <Button onClick={() => store.markSmsCandidateLater(candidate.id)}>
                <Clock3 size={15} /> 나중에
              </Button>
              <Button
                $variant="danger"
                onClick={() => store.ignoreSmsCandidate(candidate.id)}
              >
                <XCircle size={15} /> 제외
              </Button>
            </Actions>
          </Candidate>
        ))}

        {store.deferredSmsCandidates.length === 0 ? (
          <Empty>
            <Archive size={20} />
            <span>후보 없음</span>
          </Empty>
        ) : null}
      </CandidateList>

      <QuickExamples>
        {examples.map((item) => (
          <Button key={item.label} onClick={() => setRawText(item.value)}>
            {item.label}
          </Button>
        ))}
      </QuickExamples>
    </Panel>
  )
})

const Composer = styled.div`
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};
`

const CandidateList = styled.div`
  display: grid;
  gap: 10px;
  padding: 16px 18px;
`

const Candidate = styled.article`
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: #fff;
  padding: 12px;
`

const CandidateTop = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
`

const Meta = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  margin-top: 2px;
`

const Status = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${colors.muted};
  font-size: 11px;

  &::before {
    width: 6px;
    height: 6px;
    border-radius: ${radii.round};
    background: ${colors.amber};
    content: "";
  }
`

const Masked = styled.div`
  margin-top: 10px;
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  padding: 10px;
  color: ${colors.ink};
  font-size: 13px;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`

const Empty = styled.div`
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: ${colors.muted};
  border-bottom: 1px solid ${colors.border};
  font-size: 12px;
`

const QuickExamples = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 16px;
`
