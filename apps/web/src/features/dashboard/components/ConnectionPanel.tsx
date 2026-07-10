"use client"

import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"
import { CheckCircle2, Database, RefreshCw, ShieldCheck, TriangleAlert, Wifi } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Panel, PanelHeader, PanelTitle } from "../styles"

export const ConnectionPanel = observer(function ConnectionPanel() {
  const store = useAppStore()
  const status = store.supabaseConnection

  useEffect(() => {
    void store.checkSupabase()
  }, [store])

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Supabase 연결</PanelTitle>
        <Button $variant="primary" onClick={store.checkSupabase} disabled={status.state === "checking"}>
          <RefreshCw size={16} /> 다시 확인
        </Button>
      </PanelHeader>

      <Content>
        <StatusCard $state={status.state}>
          {status.state === "configured" ? <CheckCircle2 size={24} /> : <TriangleAlert size={24} />}
          <div>
            <strong>{status.state === "configured" ? "연결 준비 완료" : "확인 필요"}</strong>
            <p>{status.message}</p>
          </div>
        </StatusCard>

        <Checks>
          <CheckItem $ok={status.hasUrl}>
            <Wifi size={18} />
            <span>Project URL</span>
            <strong>{status.hasUrl ? "설정됨" : "없음"}</strong>
          </CheckItem>
          <CheckItem $ok={status.hasAnonKey}>
            <ShieldCheck size={18} />
            <span>Anon key</span>
            <strong>{status.hasAnonKey ? "설정됨" : "없음"}</strong>
          </CheckItem>
          <CheckItem $ok={status.canReachAuth}>
            <ShieldCheck size={18} />
            <span>Auth endpoint</span>
            <strong>{status.canReachAuth ? "응답" : "미확인"}</strong>
          </CheckItem>
          <CheckItem $ok={status.canReachSchema}>
            <Database size={18} />
            <span>profiles table</span>
            <strong>{status.canReachSchema ? "확인됨" : "미확인"}</strong>
          </CheckItem>
        </Checks>

        <Note>
          {status.isAuthenticated
            ? `${store.authUser?.nickname ?? "사용자"}님의 Supabase 세션이 연결되어 있습니다.`
            : "현재는 로그인 전 상태입니다. 사이드바에서 카카오 로그인을 진행해 주세요."}
        </Note>
      </Content>
    </Panel>
  )
})

const Content = styled.div`
  display: grid;
  gap: 14px;
  padding: 18px;
`

const StatusCard = styled.div<{ $state: string }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  border: 1px solid ${({ $state }) => ($state === "configured" ? "rgba(45, 106, 79, 0.32)" : colors.border)};
  border-radius: 8px;
  background: ${({ $state }) => ($state === "configured" ? "#eef7f4" : "#fffaf0")};
  color: ${({ $state }) => ($state === "configured" ? colors.green : colors.ink)};
  padding: 14px;

  p {
    margin: 4px 0 0;
    color: ${colors.muted};
  }
`

const Checks = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const CheckItem = styled.div<{ $ok: boolean }>`
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  padding: 12px;

  svg,
  strong {
    color: ${({ $ok }) => ($ok ? colors.green : colors.coral)};
  }

  span {
    color: ${colors.muted};
  }
`

const Note = styled.div`
  border: 1px dashed ${colors.border};
  border-radius: 8px;
  color: ${colors.muted};
  padding: 12px;
`
