"use client"

import styled from "@emotion/styled"
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@salimon/types"
import { colors, radii, shadows } from "@salimon/ui-tokens"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"
import { Button } from "../styles"

export const LegalConsentGate = observer(function LegalConsentGate() {
  const store = useAppStore()
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <Page>
      <Card>
        <Title>
          <ShieldCheck size={24} />
          <div>
            <h1>살림온 이용 전 확인해 주세요</h1>
            <p>공동생활비 기록과 정산을 위한 필수 동의입니다.</p>
          </div>
        </Title>
        <ConsentLabel>
          <input
            type="checkbox"
            checked={termsChecked}
            onChange={(event) => setTermsChecked(event.target.checked)}
          />
          <span>
            [필수] <Link href="/terms" target="_blank">이용약관</Link>을 읽고
            동의합니다. <small>버전 {CURRENT_TERMS_VERSION}</small>
          </span>
        </ConsentLabel>
        <ConsentLabel>
          <input
            type="checkbox"
            checked={privacyChecked}
            onChange={(event) => setPrivacyChecked(event.target.checked)}
          />
          <span>
            [필수] <Link href="/privacy" target="_blank">개인정보 처리방침</Link>을
            읽고 개인정보 처리에 동의합니다. <small>버전 {CURRENT_PRIVACY_VERSION}</small>
          </span>
        </ConsentLabel>
        <Notice>
          동의 시각과 문서 버전만 기록하며, 동의 증명을 위해 IP 주소나 브라우저
          식별정보를 추가 수집하지 않습니다.
        </Notice>
        {store.dataError ? <Error role="alert">{store.dataError}</Error> : null}
        <Actions>
          <Button type="button" onClick={store.logout}>로그아웃</Button>
          <Button
            type="button"
            $variant="primary"
            disabled={!termsChecked || !privacyChecked || saving}
            onClick={async () => {
              setSaving(true)
              await store.acceptLegalTerms()
              setSaving(false)
            }}
          >
            {saving ? "동의 기록 중" : "동의하고 시작하기"}
          </Button>
        </Actions>
      </Card>
    </Page>
  )
})

const Page = styled.main`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: ${colors.canvas};
  padding: 20px;
`
const Card = styled.section`
  width: min(520px, 100%);
  display: grid;
  gap: 14px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: ${shadows.panel};
  padding: clamp(20px, 5vw, 34px);
`
const Title = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 5px;
  svg { flex: 0 0 auto; color: ${colors.teal}; }
  h1 { margin: 0; font-size: 21px; }
  p { margin: 5px 0 0; color: ${colors.muted}; font-size: 12px; }
`
const ConsentLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  padding: 12px;
  color: ${colors.ink};
  font-size: 12px;
  line-height: 1.5;
  input { width: 16px; height: 16px; margin-top: 1px; accent-color: ${colors.teal}; }
  a { color: ${colors.teal}; font-weight: 700; }
  small { display: block; color: ${colors.muted}; font-size: 10px; }
`
const Notice = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 11px;
  line-height: 1.5;
`
const Error = styled.p`
  margin: 0;
  color: ${colors.coral};
  font-size: 12px;
`
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`
