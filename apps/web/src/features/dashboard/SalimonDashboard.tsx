"use client"

import { observer } from "mobx-react-lite"
import {
  CalendarDays,
  Database,
  Landmark,
  ListFilter,
  Plus,
  Settings2,
  Star,
  Tags,
  WalletCards,
  ChartNoAxesCombined,
} from "lucide-react"
import { StoreProvider, useAppStore } from "./StoreProvider"
import { CalendarGrid } from "./components/CalendarGrid"
import { AuthControls } from "./components/AuthControls"
import { AccountManager } from "./components/AccountManager"
import { CategoryManager } from "./components/CategoryManager"
import { CardManager } from "./components/CardManager"
import { ConnectionPanel } from "./components/ConnectionPanel"
import { LedgerManagementPanel } from "./components/LedgerManagementPanel"
import { TransactionPanel } from "./components/TransactionPanel"
import { TransactionListPanel } from "./components/TransactionListPanel"
import { SettlementPanel } from "./components/SettlementPanel"
import {
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
  const currentMembership = store.data.members.find(
    (member) =>
      member.ledgerId === store.selectedLedgerId &&
      member.userId === store.authUser?.id,
  )

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
    <Shell $showTransactionPanel={store.activeView === "calendar"}>
      <Sidebar>
        <Brand
          type="button"
          onClick={() => store.setView("calendar")}
          aria-label="기본 대시보드로 이동"
        >
          <BrandMark aria-hidden="true">S</BrandMark>
          <BrandName>Salimon</BrandName>
        </Brand>

        <LedgerField>
          <LedgerLabel>
            <WalletCards size={14} /> 가계부
          </LedgerLabel>
          <LedgerControl>
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
                  {ledger.name} · {ledger.type === "shared" ? "공동" : "개인"}
                </option>
              ))}
            </LedgerSelect>
            <DefaultLedgerButton
              type="button"
              $active={Boolean(currentMembership?.isDefault)}
              disabled={
                !store.selectedLedgerId || Boolean(currentMembership?.isDefault)
              }
              title={
                currentMembership?.isDefault
                  ? "현재 기본 가계부입니다"
                  : "기본 가계부로 설정"
              }
              aria-label={
                currentMembership?.isDefault
                  ? "현재 기본 가계부"
                  : "기본 가계부로 설정"
              }
              onClick={() =>
                void store.setDefaultLedger(store.selectedLedgerId)
              }
            >
              <Star
                size={15}
                fill={currentMembership?.isDefault ? "currentColor" : "none"}
              />
            </DefaultLedgerButton>
            <LedgerManageButton
              type="button"
              $active={false}
              title="새 가계부 만들기"
              aria-label="새 가계부 만들기"
              onClick={() => store.setView("ledger")}
            >
              <Plus size={15} />
            </LedgerManageButton>
          </LedgerControl>
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
          <Metric>
            <MetricLabel>월 저축</MetricLabel>
            <MetricValue $tone="saving">
              {formatKrw(store.monthSavingTotal)}
            </MetricValue>
          </Metric>
        </MetricRow>

        <Nav>
          <NavButton
            $active={store.activeView === "calendar"}
            aria-current={store.activeView === "calendar" ? "page" : undefined}
            onClick={() => store.setView("calendar")}
          >
            <CalendarDays size={17} /> 캘린더
          </NavButton>
          <NavButton
            $active={store.activeView === "transactions"}
            aria-current={
              store.activeView === "transactions" ? "page" : undefined
            }
            onClick={() => store.setView("transactions")}
          >
            <ListFilter size={17} /> 내역 검색
          </NavButton>
          <NavButton
            $active={store.activeView === "settlement"}
            aria-current={
              store.activeView === "settlement" ? "page" : undefined
            }
            onClick={() => store.setView("settlement")}
          >
            <ChartNoAxesCombined size={17} /> 정산
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
            $active={store.activeView === "cards"}
            aria-current={store.activeView === "cards" ? "page" : undefined}
            onClick={() => store.setView("cards")}
          >
            <WalletCards size={17} /> 카드 관리
          </NavButton>
          <NavButton
            $active={store.activeView === "accounts"}
            aria-current={store.activeView === "accounts" ? "page" : undefined}
            onClick={() => store.setView("accounts")}
          >
            <Landmark size={17} /> 계좌 관리
          </NavButton>
          <NavButton
            $active={store.activeView === "ledger"}
            aria-current={store.activeView === "ledger" ? "page" : undefined}
            onClick={() => store.setView("ledger")}
          >
            <Settings2 size={17} /> 가계부 관리
          </NavButton>
          {isLocalDevelopment ? (
            <NavButton
              $active={store.activeView === "connection"}
              aria-current={
                store.activeView === "connection" ? "page" : undefined
              }
              onClick={() => store.setView("connection")}
            >
              <Database size={17} /> 앱 관리
            </NavButton>
          ) : null}
        </Nav>

        <SidebarFooter>
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
        </Topline>

        {store.activeView === "calendar" ? <CalendarGrid /> : null}
        {store.activeView === "transactions" ? <TransactionListPanel /> : null}
        {store.activeView === "categories" ? <CategoryManager /> : null}
        {store.activeView === "cards" ? <CardManager /> : null}
        {store.activeView === "accounts" ? (
          <AccountManager key={store.selectedLedgerId} />
        ) : null}
        {store.activeView === "settlement" ? <SettlementPanel /> : null}
        {store.activeView === "ledger" ? (
          <LedgerManagementPanel key={store.selectedLedgerId} />
        ) : null}
        {isLocalDevelopment && store.activeView === "connection" ? (
          <ConnectionPanel />
        ) : null}
        {store.dataError ? (
          <DataError role="alert">{store.dataError}</DataError>
        ) : null}
      </Workspace>

      {store.activeView === "calendar" ? (
        <TransactionPanel
          key={`${store.selectedLedgerId}-${store.selectedDate}`}
        />
      ) : null}
      {store.toast ? (
        <Toast
          $tone={store.toast.tone}
          role="status"
          onClick={store.dismissToast}
        >
          {store.toast.message}
        </Toast>
      ) : null}
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

const Brand = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: 0 ${spacing[1]} ${spacing[2]};
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
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

const LedgerField = styled.div`
  display: grid;
  gap: ${spacing[2]};
`

const LedgerControl = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px 36px;
  gap: 6px;
`

const DefaultLedgerButton = styled.button<{ $active: boolean }>`
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  background: ${({ $active }) => ($active ? "#fff7d6" : "#fff")};
  color: ${({ $active }) => ($active ? "#b7791f" : colors.muted)};

  &:disabled {
    cursor: default;
  }
`

const LedgerManageButton = styled(DefaultLedgerButton)`
  background: #fff;
  color: ${colors.muted};

  &:hover {
    background: ${colors.panelSubtle};
    color: ${colors.ink};
  }
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
    max-width: 320px;
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

const DataError = styled.p`
  margin: 14px 0 0;
  color: ${colors.coral};
  font-size: 13px;
`

const Toast = styled.button<{ $tone: "success" | "error" | "info" }>`
  position: fixed;
  z-index: 1000;
  top: 20px;
  right: 20px;
  min-width: 220px;
  max-width: min(440px, calc(100vw - 32px));
  border: 1px solid
    ${({ $tone }) =>
      $tone === "error"
        ? "#fecaca"
        : $tone === "success"
          ? "#bbf7d0"
          : colors.border};
  border-radius: ${radii.sm};
  background: ${({ $tone }) =>
    $tone === "error" ? "#fff1f2" : $tone === "success" ? "#f0fdf4" : "#fff"};
  color: ${({ $tone }) =>
    $tone === "error"
      ? colors.coral
      : $tone === "success"
        ? colors.green
        : colors.ink};
  padding: 11px 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
  font-size: 13px;
  font-weight: 650;
`
