"use client"

import styled from "@emotion/styled"
import { formatMoneyInput, maskSensitiveText } from "@salimon/domain"
import { colors, radii } from "@salimon/ui-tokens"
import { Send } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { useAppStore } from "../StoreProvider"
import {
  Button,
  Field,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  Textarea,
} from "../styles"

export const SampleSubmissionPanel = observer(function SampleSubmissionPanel() {
  const store = useAppStore()
  const [company, setCompany] = useState("")
  const [message, setMessage] = useState("")
  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [consent, setConsent] = useState(false)
  const masked = useMemo(() => maskSensitiveText(message), [message])

  async function submit() {
    const submitted = await store.submitCardMessageSample({
      cardCompanyName: company || undefined,
      message,
      expectedAmount: amount ? Number(amount) : undefined,
      expectedMerchantName: merchant || undefined,
    })
    if (submitted) {
      setCompany("")
      setMessage("")
      setAmount("")
      setMerchant("")
      setConsent(false)
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>카드 문자 샘플</PanelTitle>
        <Button
          $variant="primary"
          disabled={!message.trim() || !consent || !store.authUser}
          onClick={() => void submit()}
        >
          <Send size={16} /> 제출
        </Button>
      </PanelHeader>

      <FormGrid>
        <Field>
          카드사
          <Input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </Field>
        <Field>
          예상 금액
          <Input
            inputMode="numeric"
            value={formatMoneyInput(amount)}
            onChange={(event) =>
              setAmount(event.target.value.replace(/\D/g, ""))
            }
          />
        </Field>
        <Field>
          예상 가맹점
          <Input
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />
        </Field>
        <Field>
          문자 예시
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
      </FormGrid>

      <Preview>
        <strong>마스킹 미리보기</strong>
        <Masked>{masked || " "}</Masked>
        <Consent>
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          익명화된 샘플 저장 동의
        </Consent>
      </Preview>

      <Submissions>
        {store.data.cardMessageSamples.map((sample) => (
          <Submission key={sample.id}>
            <strong>{sample.cardCompanyName || "카드사 미입력"}</strong>
            <span>{sample.maskedMessage}</span>
          </Submission>
        ))}
      </Submissions>
    </Panel>
  )
})

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.panelSubtle};

  label:last-child {
    grid-column: 1 / -1;
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`

const Preview = styled.div`
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};

  > strong {
    font-size: 12px;
    font-weight: 600;
  }
`

const Masked = styled.div`
  min-height: 48px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: #fff;
  padding: 10px;
`

const Consent = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${colors.muted};
  font-size: 13px;
`

const Submissions = styled.div`
  display: grid;
  padding: 4px 18px 12px;
`

const Submission = styled.div`
  display: grid;
  gap: 4px;
  border-bottom: 1px solid ${colors.border};
  padding: 10px 0;

  span {
    color: ${colors.muted};
    font-size: 13px;
  }
`
