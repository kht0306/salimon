"use client"

import { observer } from "mobx-react-lite"
import {
  CalendarDays,
  ClipboardCheck,
  Database,
  Layers3,
  MessageSquareText,
  RotateCcw,
  Tags,
  Users,
} from "lucide-react"
import { StoreProvider, useAppStore } from "./StoreProvider"
import { CalendarGrid } from "./components/CalendarGrid"
import { AuthControls } from "./components/AuthControls"
import { CategoryManager } from "./components/CategoryManager"
import { ConnectionPanel } from "./components/ConnectionPanel"
import { SampleSubmissionPanel } from "./components/SampleSubmissionPanel"
import { SharedLedgerPanel } from "./components/SharedLedgerPanel"
import { SmsCandidatePanel } from "./components/SmsCandidatePanel"
import { TransactionPanel } from "./components/TransactionPanel"
import { Button, Metric, MetricLabel, MetricRow, MetricValue, Sidebar, Shell, Workspace } from "./styles"
import { formatKrw } from "@salimon/domain"
import styled from "@emotion/styled"
import { colors } from "@salimon/ui-tokens"

export function SalimonDashboard() {
  return (
    <StoreProvider>
      <DashboardContent />
    </StoreProvider>
  )
}

const DashboardContent = observer(function DashboardContent() {
  const store = useAppStore()

  return (
    <Shell>
      <Sidebar>
        <Brand>
          <BrandMark>Sa</BrandMark>
          <div>
            <BrandName>Salimon</BrandName>
            <BrandSub>{store.authUser?.nickname ?? store.profile.nickname}</BrandSub>
          </div>
        </Brand>

        <AuthControls />

        <LedgerSelect
          value={store.selectedLedgerId}
          onChange={(event) => store.switchLedger(event.target.value)}
          aria-label="가계부 선택"
        >
          {store.data.ledgers.map((ledger) => (
            <option key={ledger.id} value={ledger.id}>
              {ledger.name}
            </option>
          ))}
        </LedgerSelect>

        <MetricRow>
          <Metric>
            <MetricLabel>월 지출</MetricLabel>
            <MetricValue $tone="expense">{formatKrw(store.monthExpenseTotal)}</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>월 수입</MetricLabel>
            <MetricValue $tone="income">{formatKrw(store.monthIncomeTotal)}</MetricValue>
          </Metric>
        </MetricRow>

        <Nav>
          <NavButton $active={store.activeView === "calendar"} onClick={() => store.setView("calendar")}>
            <CalendarDays size={17} /> 캘린더
          </NavButton>
          <NavButton $active={store.activeView === "categories"} onClick={() => store.setView("categories")}>
            <Tags size={17} /> 카테고리
          </NavButton>
          <NavButton $active={store.activeView === "shared"} onClick={() => store.setView("shared")}>
            <Users size={17} /> 공동
          </NavButton>
          <NavButton $active={store.activeView === "sms"} onClick={() => store.setView("sms")}>
            <MessageSquareText size={17} /> 문자 후보
            {store.deferredSmsCandidates.length > 0 ? <Pill>{store.deferredSmsCandidates.length}</Pill> : null}
          </NavButton>
          <NavButton $active={store.activeView === "samples"} onClick={() => store.setView("samples")}>
            <ClipboardCheck size={17} /> 샘플
          </NavButton>
          <NavButton $active={store.activeView === "connection"} onClick={() => store.setView("connection")}>
            <Database size={17} /> 연결
          </NavButton>
        </Nav>

        <Button $variant="ghost" onClick={store.resetDemo} title="데모 데이터 초기화">
          <RotateCcw size={16} /> 초기화
        </Button>
      </Sidebar>

      <Workspace>
        <Topline>
          <div>
            <Eyebrow>
              <Layers3 size={15} /> {store.currentLedger?.type === "shared" ? "공동 가계부" : "개인 가계부"}
            </Eyebrow>
            <PageTitle>{store.currentLedger?.name ?? "가계부"}</PageTitle>
          </div>
          <UserBadge $connected={Boolean(store.authUser)}>{store.authUser ? "카카오 연결됨" : "로그인 필요"}</UserBadge>
        </Topline>

        {store.activeView === "calendar" ? <CalendarGrid /> : null}
        {store.activeView === "categories" ? <CategoryManager /> : null}
        {store.activeView === "shared" ? <SharedLedgerPanel /> : null}
        {store.activeView === "sms" ? <SmsCandidatePanel /> : null}
        {store.activeView === "samples" ? <SampleSubmissionPanel /> : null}
        {store.activeView === "connection" ? <ConnectionPanel /> : null}
      </Workspace>

      <TransactionPanel />
    </Shell>
  )
})

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const BrandMark = styled.div`
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: ${colors.ink};
  color: #fff;
  font-weight: 850;
`

const BrandName = styled.div`
  font-size: 18px;
  font-weight: 850;
`

const BrandSub = styled.div`
  color: ${colors.muted};
  font-size: 12px;
`

const LedgerSelect = styled.select`
  width: 100%;
  min-height: 40px;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;
`

const Nav = styled.nav`
  display: grid;
  gap: 6px;
`

const NavButton = styled.button<{ $active: boolean }>`
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid ${({ $active }) => ($active ? "rgba(15, 139, 141, 0.42)" : "transparent")};
  border-radius: 8px;
  background: ${({ $active }) => ($active ? "#eef7f4" : "transparent")};
  color: ${({ $active }) => ($active ? colors.green : colors.ink)};
  padding: 0 10px;
  text-align: left;
`

const Pill = styled.span`
  margin-left: auto;
  min-width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: ${colors.coral};
  color: #fff;
  font-size: 12px;
  font-weight: 800;
`

const Topline = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
`

const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${colors.muted};
  font-size: 13px;
  font-weight: 700;
`

const PageTitle = styled.h1`
  margin: 3px 0 0;
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.08;
  letter-spacing: 0;
`

const UserBadge = styled.div<{ $connected: boolean }>`
  border: 1px solid ${colors.border};
  border-radius: 999px;
  background: ${({ $connected }) => ($connected ? "#eef7f4" : "#fff")};
  color: ${({ $connected }) => ($connected ? colors.green : colors.muted)};
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 750;
`
