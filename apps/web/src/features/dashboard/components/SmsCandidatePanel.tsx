"use client"

import styled from "@emotion/styled"
import { formatKrw } from "@salimon/domain"
import { colors } from "@salimon/ui-tokens"
import { Archive, Bell, CheckCircle2, Clock3, Plus, SearchCheck, XCircle } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Field, Panel, PanelHeader, PanelTitle, Textarea } from "../styles"

const example = "[카드사] 06/28 12:34 스타벅스 5,800원 승인"

export const SmsCandidatePanel = observer(function SmsCandidatePanel() {
  const store = useAppStore()
  const [rawText, setRawText] = useState(example)

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>미등록 카드 문자</PanelTitle>
        <Button $variant="primary" onClick={() => store.detectSmsCandidate(rawText)}>
          <Bell size={16} /> 감지
        </Button>
      </PanelHeader>

      <Composer>
        <Field>
          테스트 문자
          <Textarea value={rawText} onChange={(event) => setRawText(event.target.value)} />
        </Field>
      </Composer>

      <CandidateList>
        {store.deferredSmsCandidates.map((candidate) => (
          <Candidate key={candidate.id}>
            <CandidateTop>
              <SearchCheck size={18} />
              <div>
                <strong>{candidate.parsed.merchantName || "카드 사용 후보"}</strong>
                <Meta>
                  {formatKrw(candidate.parsed.amount)} · 신뢰도 {Math.round(candidate.parsed.confidence * 100)}%
                </Meta>
              </div>
              <Status>{candidate.status}</Status>
            </CandidateTop>
            <Masked>{candidate.maskedMessage}</Masked>
            <Actions>
              <Button $variant="primary" onClick={() => store.registerSmsCandidate(candidate.id)}>
                <CheckCircle2 size={15} /> 기타 등록
              </Button>
              <Button onClick={() => store.markSmsCandidateLater(candidate.id)}>
                <Clock3 size={15} /> 나중에
              </Button>
              <Button $variant="danger" onClick={() => store.ignoreSmsCandidate(candidate.id)}>
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
        {[
          "[국민카드] 06/28 12:34 5,800원 스타벅스 승인",
          "체크카드 15,000원 사용 CU편의점",
          "현대카드 일시불 승인 23,400원 쿠팡",
        ].map((item) => (
          <Button key={item} onClick={() => setRawText(item)}>
            <Plus size={14} /> 예시
          </Button>
        ))}
      </QuickExamples>
    </Panel>
  )
})

const Composer = styled.div`
  padding: 16px 18px;
`

const CandidateList = styled.div`
  display: grid;
  gap: 10px;
  padding: 0 18px 18px;
`

const Candidate = styled.article`
  border: 1px solid ${colors.border};
  border-radius: 8px;
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
  border: 1px solid ${colors.border};
  border-radius: 999px;
  padding: 4px 8px;
  color: ${colors.muted};
  font-size: 12px;
`

const Masked = styled.div`
  margin-top: 10px;
  border-radius: 8px;
  background: #f6f7f3;
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
  min-height: 100px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: ${colors.muted};
  border: 1px dashed ${colors.border};
  border-radius: 8px;
`

const QuickExamples = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 18px;
`
