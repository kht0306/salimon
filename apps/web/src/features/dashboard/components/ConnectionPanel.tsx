"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import {
  CheckCircle2,
  Database,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Wifi,
} from "lucide-react"
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
        <PanelTitle>앱 관리</PanelTitle>
        <Button
          $variant="primary"
          onClick={() => void store.checkSupabase(true)}
          disabled={status.state === "checking"}
        >
          <RefreshCw size={16} /> 다시 확인
        </Button>
      </PanelHeader>

      <Content>
        <StatusCard $state={status.state}>
          {status.state === "configured" ? (
            <CheckCircle2 size={24} />
          ) : (
            <TriangleAlert size={24} />
          )}
          <div>
            <strong>
              {status.state === "configured" ? "연결 준비 완료" : "확인 필요"}
            </strong>
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
        <DangerZone>
          <div>
            <strong>테스트 데이터 초기화</strong>
            <p>
              거래와 고정비·할부 규칙 등 테스트 데이터를 삭제합니다. 가계부,
              카테고리, 예산과 카드 설정은 유지됩니다.
            </p>
          </div>
          <Button
            $variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "거래와 고정비·할부 규칙을 초기화하시겠습니까? 카테고리와 카드 설정은 유지되며, 삭제한 거래 데이터는 되돌릴 수 없습니다.",
                )
              )
                void store.resetMyFinanceData()
            }}
          >
            <RotateCcw size={14} /> 초기화
          </Button>
        </DangerZone>
      </Content>
    </Panel>
  )
})

const Content = styled.div`
  display: grid;
`

const StatusCard = styled.div<{ $state: string }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  border-bottom: 1px solid ${colors.border};
  background: ${({ $state }) =>
    $state === "configured" ? colors.greenSoft : "#fffbeb"};
  color: ${({ $state }) =>
    $state === "configured" ? colors.green : colors.ink};
  padding: 16px 18px;

  p {
    margin: 4px 0 0;
    color: ${colors.muted};
  }
`

const Checks = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 8px 18px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;

    > div {
      padding-right: 0;
      padding-left: 0;
      border-left: 0;
    }
  }
`

const CheckItem = styled.div<{ $ok: boolean }>`
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid ${colors.border};
  padding: 12px 0;

  &:nth-of-type(odd) {
    padding-right: 14px;
  }

  &:nth-of-type(even) {
    padding-left: 14px;
    border-left: 1px solid ${colors.border};
  }

  svg,
  strong {
    color: ${({ $ok }) => ($ok ? colors.green : colors.coral)};
  }

  span {
    color: ${colors.muted};
  }
`

const Note = styled.div`
  margin: 10px 18px 16px;
  border-radius: ${radii.sm};
  background: ${colors.panelSubtle};
  color: ${colors.muted};
  padding: 12px;
  font-size: 12px;
`

const DangerZone = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid ${colors.border};
  padding: 18px;

  p {
    margin: 3px 0 0;
    color: ${colors.muted};
    font-size: 12px;
  }
`
