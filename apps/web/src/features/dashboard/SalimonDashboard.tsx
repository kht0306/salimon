"use client"

import { observer } from "mobx-react-lite"
import {
  CalendarDays,
  ClipboardCheck,
  Database,
  MessageSquareText,
  ListFilter,
  RefreshCw,
  Tags,
  Users,
  WalletCards,
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
import { TransactionListPanel } from "./components/TransactionListPanel"
import {
  Button,
  Metric,
  MetricLabel,
  MetricRow,
  MetricValue,
  Sidebar,
  Shell,
  Workspace,
} from "./styles"
import { formatKrw } from "@salimon/domain"
import styled from "@emotion/styled"
import { colors, radii, spacing } from "@salimon/ui-tokens"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const isLocalDevelopment = process.env.NODE_ENV === "development"

export function SalimonDashboard() {
  return (
    <StoreProvider>
      <DashboardContent />
    </StoreProvider>
  )
}

const DashboardContent = observer(function DashboardContent() {
  const store = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (store.authState !== "loading" && !store.authUser) {
      router.replace("/login")
    }
  }, [router, store.authState, store.authUser])

  if (!store.authUser) {
    return (
      <AuthLoading>
        {store.authState === "loading"
          ? "로그인 상태를 확인하고 있습니다."
          : "로그인 페이지로 이동합니다."}
      </AuthLoading>
    )
  }

  return (
    <Shell>
      <Sidebar>
        <Brand>
          <BrandMark aria-hidden="true">S</BrandMark>
          <BrandName>Salimon</BrandName>
        </Brand>

        <LedgerField>
          <LedgerLabel>
            <WalletCards size={14} /> 가계부
          </LedgerLabel>
          <LedgerSelect
            value={store.selectedLedgerId}
            onChange={(event) => store.switchLedger(event.target.value)}
            aria-label="가계부 선택"
            disabled={store.data.ledgers.length === 0}
          >
            {store.data.ledgers.length === 0 ? (
              <option value="">로그인 후 불러오기</option>
            ) : null}
            {store.data.ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </LedgerSelect>
        </LedgerField>

        <MetricRow>
          <Metric>
            <MetricLabel>월 지출</MetricLabel>
            <MetricValue $tone="expense">
              {formatKrw(store.monthExpenseTotal)}
            </MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>월 수입</MetricLabel>
            <MetricValue $tone="income">
              {formatKrw(store.monthIncomeTotal)}
            </MetricValue>
          </Metric>
        </MetricRow>

        <Nav>
          <NavButton
            $active={store.activeView === "transactions"}
            aria-current={
              store.activeView === "transactions" ? "page" : undefined
            }
            onClick={() => store.setView("transactions")}
          >
            <ListFilter size={17} /> 거래 목록
          </NavButton>
          <NavButton
            $active={store.activeView === "calendar"}
            aria-current={store.activeView === "calendar" ? "page" : undefined}
            onClick={() => store.setView("calendar")}
          >
            <CalendarDays size={17} /> 캘린더
          </NavButton>
          <NavButton
            $active={store.activeView === "categories"}
            aria-current={
              store.activeView === "categories" ? "page" : undefined
            }
            onClick={() => store.setView("categories")}
          >
            <Tags size={17} /> 카테고리
          </NavButton>
          <NavButton
            $active={store.activeView === "shared"}
            aria-current={store.activeView === "shared" ? "page" : undefined}
            onClick={() => store.setView("shared")}
          >
            <Users size={17} /> 공동
          </NavButton>
          <NavButton
            $active={store.activeView === "sms"}
            aria-current={store.activeView === "sms" ? "page" : undefined}
            onClick={() => store.setView("sms")}
          >
            <MessageSquareText size={17} /> 문자 후보
            {store.deferredSmsCandidates.length > 0 ? (
              <Pill>{store.deferredSmsCandidates.length}</Pill>
            ) : null}
          </NavButton>
          <NavButton
            $active={store.activeView === "samples"}
            aria-current={store.activeView === "samples" ? "page" : undefined}
            onClick={() => store.setView("samples")}
          >
            <ClipboardCheck size={17} /> 샘플
          </NavButton>
          {isLocalDevelopment ? (
            <NavButton
              $active={store.activeView === "connection"}
              aria-current={
                store.activeView === "connection" ? "page" : undefined
              }
              onClick={() => store.setView("connection")}
            >
              <Database size={17} /> 연결
            </NavButton>
          ) : null}
        </Nav>

        <SidebarFooter>
          <Button
            $variant="ghost"
            onClick={() => void store.refreshFinanceData()}
            disabled={!store.authUser || store.dataState === "loading"}
            title="Supabase 데이터 새로고침"
          >
            <RefreshCw size={15} />{" "}
            {store.dataState === "loading" ? "동기화 중" : "새로고침"}
          </Button>
          <AuthControls />
        </SidebarFooter>
      </Sidebar>

      <Workspace>
        <Topline>
          <div>
            <Eyebrow>
              가계부 /{" "}
              {store.currentLedger?.type === "shared" ? "공동" : "개인"}
            </Eyebrow>
            <PageTitle>{store.currentLedger?.name ?? "가계부"}</PageTitle>
          </div>
          <ConnectionStatus $connected={Boolean(store.authUser)}>
            <StatusDot />
            {store.authUser ? "동기화됨" : "로그인 필요"}
          </ConnectionStatus>
        </Topline>

        {store.activeView === "calendar" ? <CalendarGrid /> : null}
        {store.activeView === "transactions" ? <TransactionListPanel /> : null}
        {store.activeView === "categories" ? <CategoryManager /> : null}
        {store.activeView === "shared" ? <SharedLedgerPanel /> : null}
        {store.activeView === "sms" ? <SmsCandidatePanel /> : null}
        {store.activeView === "samples" ? <SampleSubmissionPanel /> : null}
        {isLocalDevelopment && store.activeView === "connection" ? (
          <ConnectionPanel />
        ) : null}
        {store.dataError ? (
          <DataError role="alert">{store.dataError}</DataError>
        ) : null}
      </Workspace>

      <TransactionPanel key={store.selectedLedgerId} />
    </Shell>
  )
})

const AuthLoading = styled.main`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: ${colors.canvas};
  color: ${colors.muted};
`

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: 0 ${spacing[1]} ${spacing[2]};
`

const BrandMark = styled.div`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: ${radii.sm};
  background: ${colors.ink};
  color: #fff;
  font-size: 14px;
  font-weight: 700;
`

const BrandName = styled.div`
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
`

const LedgerField = styled.label`
  display: grid;
  gap: ${spacing[2]};
`

const LedgerLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${colors.muted};
  font-size: 11px;
  font-weight: 600;
`

const LedgerSelect = styled.select`
  width: 100%;
  min-height: 36px;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
`

const Nav = styled.nav`
  display: grid;
  gap: 2px;

  @media (max-width: 820px) {
    display: flex;
    overflow-x: auto;
    padding-bottom: 2px;
  }
`

const NavButton = styled.button<{ $active: boolean }>`
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: ${radii.sm};
  background: ${({ $active }) => ($active ? "#f0f0f2" : "transparent")};
  color: ${({ $active }) => ($active ? colors.ink : colors.muted)};
  padding: 0 10px;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  text-align: left;
  white-space: nowrap;
  transition:
    background-color 140ms ease,
    color 140ms ease;

  &:hover {
    background: ${colors.panelSubtle};
    color: ${colors.ink};
  }
`

const Pill = styled.span`
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: ${radii.round};
  background: ${colors.coral};
  color: #fff;
  font-size: 10px;
  font-weight: 700;
`

const SidebarFooter = styled.div`
  display: grid;
  gap: ${spacing[2]};
  margin-top: auto;
  padding-top: ${spacing[3]};
  border-top: 1px solid ${colors.border};

  > button {
    width: 100%;
  }

  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
`

const Topline = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: ${spacing[5]};
`

const Eyebrow = styled.div`
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 500;
`

const PageTitle = styled.h1`
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
`

const ConnectionStatus = styled.div<{ $connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: ${colors.muted};
  padding-top: 7px;
  font-size: 12px;
  font-weight: 500;

  > span {
    background: ${({ $connected }) =>
      $connected ? colors.green : colors.subtle};
  }
`

const StatusDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: ${radii.round};
`

const DataError = styled.p`
  margin: 14px 0 0;
  color: ${colors.coral};
  font-size: 13px;
`
