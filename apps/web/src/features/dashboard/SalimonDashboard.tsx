"use client"

import { observer } from "mobx-react-lite"
import {
  CalendarDays,
  Database,
  Landmark,
  ListFilter,
  Plus,
  Settings2,
  ShieldCheck,
  Star,
  Tags,
  WalletCards,
  ChartNoAxesCombined,
} from "lucide-react"
import { useAppStore } from "./StoreProvider"
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
import { TrustCenter } from "./components/TrustCenter"
import { OnboardingChecklist } from "./components/OnboardingChecklist"
import { LegalConsentGate } from "./components/LegalConsentGate"
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
import Link from "next/link"
import { useEffect } from "react"
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@salimon/types"
import {
  dashboardRoutes,
  getLedgerSelectionRoute,
  shouldRedirectToLedgerManagement,
  type DashboardView,
} from "./routes"

const isLocalDevelopment = process.env.NODE_ENV === "development"

interface SalimonDashboardProps {
  view: DashboardView
}

export function SalimonDashboard({ view }: SalimonDashboardProps) {
  return <DashboardContent view={view} />
}

const DashboardContent = observer(function DashboardContent({
  view,
}: SalimonDashboardProps) {
  const store = useAppStore()
  const router = useRouter()
  const currentMembership = store.currentMembership
  const hasCurrentLedger = Boolean(store.currentLedger)
  const isArchivedLedger = Boolean(store.currentLedger?.archivedAt)

  useEffect(() => {
    if (
      store.authState !== "loading" &&
      (store.authState !== "authenticated" || !store.authUser)
    ) {
      router.replace("/login")
      return
    }

    if (
      store.authState === "authenticated" &&
      store.dataState === "ready" &&
      shouldRedirectToLedgerManagement(view, store.currentLedger)
    ) {
      router.replace(dashboardRoutes.ledger)
      return
    }

    if (
      store.authState === "authenticated" &&
      view === "connection" &&
      !isLocalDevelopment
    ) {
      router.replace(dashboardRoutes.calendar)
    }
  }, [
    router,
    store.authState,
    store.authUser,
    store.currentLedger,
    store.dataState,
    view,
  ])

  if (store.authState !== "authenticated" || !store.authUser) {
    return (
      <AuthLoading>
        {store.authState === "loading"
          ? "로그인 상태를 확인하고 있습니다."
          : "로그인 페이지로 이동합니다."}
      </AuthLoading>
    )
  }

  if (
    store.dataState === "ready" &&
    (store.data.legalConsent?.termsVersion !== CURRENT_TERMS_VERSION ||
      store.data.legalConsent?.privacyVersion !== CURRENT_PRIVACY_VERSION)
  ) {
    return <LegalConsentGate />
  }

  return (
    <Shell
      $showTransactionPanel={
        hasCurrentLedger && !isArchivedLedger && view === "calendar"
      }
    >
      <Sidebar>
        <Brand
          href={dashboardRoutes.calendar}
          aria-label="기본 대시보드로 이동"
        >
          <BrandMark aria-hidden="true">S</BrandMark>
          <BrandName>Salimon · 살림온</BrandName>
        </Brand>

        <LedgerField>
          <LedgerLabel>
            <WalletCards size={14} /> 가계부
          </LedgerLabel>
          <LedgerControl>
            <LedgerSelect
              value={store.selectedLedgerId}
              onChange={(event) => {
                const ledger = store.selectableLedgers.find(
                  (item) => item.id === event.target.value,
                )
                store.switchLedger(event.target.value)
                router.replace(getLedgerSelectionRoute(ledger))
              }}
              aria-label="가계부 선택"
              disabled={store.selectableLedgers.length === 0}
            >
              {store.selectableLedgers.length === 0 ? (
                <option value="">아직 가계부가 없습니다</option>
              ) : null}
              {store.selectableLedgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.name} · {ledger.type === "shared" ? "공동" : "개인"}
                  {ledger.archivedAt ? " · (보관중)" : ""}
                </option>
              ))}
            </LedgerSelect>
            <DefaultLedgerButton
              type="button"
              $active={Boolean(currentMembership?.isDefault)}
              disabled={
                !store.selectedLedgerId ||
                isArchivedLedger ||
                Boolean(currentMembership?.isDefault) ||
                store.ledgerMutationState !== "idle"
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
              href={dashboardRoutes.ledger}
              title="새 가계부 만들기"
              aria-label="새 가계부 만들기"
            >
              <Plus size={15} />
            </LedgerManageButton>
          </LedgerControl>
        </LedgerField>

        {hasCurrentLedger && !isArchivedLedger ? (
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
        ) : null}

        <Nav>
          {hasCurrentLedger && !isArchivedLedger ? (
            <>
              <NavButton
                href={dashboardRoutes.calendar}
                $active={view === "calendar"}
                aria-current={view === "calendar" ? "page" : undefined}
              >
                <CalendarDays size={17} /> 캘린더
              </NavButton>
              <NavButton
                href={dashboardRoutes.transactions}
                $active={view === "transactions"}
                aria-current={view === "transactions" ? "page" : undefined}
              >
                <ListFilter size={17} /> 내역 검색
              </NavButton>
              <NavButton
                href={dashboardRoutes.settlement}
                $active={view === "settlement"}
                aria-current={view === "settlement" ? "page" : undefined}
              >
                <ChartNoAxesCombined size={17} /> 정산
              </NavButton>
              <NavButton
                href={dashboardRoutes.categories}
                $active={view === "categories"}
                aria-current={view === "categories" ? "page" : undefined}
              >
                <Tags size={17} /> 카테고리
              </NavButton>
              <NavButton
                href={dashboardRoutes.cards}
                $active={view === "cards"}
                aria-current={view === "cards" ? "page" : undefined}
              >
                <WalletCards size={17} /> 내 카드
              </NavButton>
              <NavButton
                href={dashboardRoutes.accounts}
                $active={view === "accounts"}
                aria-current={view === "accounts" ? "page" : undefined}
              >
                <Landmark size={17} /> 내 계좌
              </NavButton>
            </>
          ) : null}
          <NavButton
            href={dashboardRoutes.ledger}
            $active={view === "ledger"}
            aria-current={view === "ledger" ? "page" : undefined}
          >
            <Settings2 size={17} /> 가계부 관리
          </NavButton>
          {isLocalDevelopment && hasCurrentLedger && !isArchivedLedger ? (
            <NavButton
              href={dashboardRoutes.connection}
              $active={view === "connection"}
              aria-current={view === "connection" ? "page" : undefined}
            >
              <Database size={17} /> 앱 관리
            </NavButton>
          ) : null}
          {hasCurrentLedger && !isArchivedLedger ? (
            <NavButton
              href={dashboardRoutes.trust}
              $active={view === "trust"}
              aria-current={view === "trust" ? "page" : undefined}
            >
              <ShieldCheck size={17} /> 개인정보·데이터
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
              {isArchivedLedger
                ? "보관중"
                : !hasCurrentLedger
                  ? "준비"
                  : store.currentLedger?.type === "shared"
                    ? "공동"
                    : "개인"}
            </Eyebrow>
            <PageTitle>
              {store.currentLedger?.name ?? "가계부 시작하기"}
            </PageTitle>
          </div>
          <MobileAuth>
            <AuthControls />
          </MobileAuth>
        </Topline>

        {hasCurrentLedger && !isArchivedLedger ? <OnboardingChecklist /> : null}

        {hasCurrentLedger && !isArchivedLedger && view === "calendar" ? (
          <CalendarGrid />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "transactions" ? (
          <TransactionListPanel />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "categories" ? (
          <CategoryManager />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "cards" ? (
          <CardManager />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "accounts" ? (
          <AccountManager key={store.selectedLedgerId} />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "settlement" ? (
          <SettlementPanel />
        ) : null}
        {hasCurrentLedger && !isArchivedLedger && view === "trust" ? (
          <TrustCenter />
        ) : null}
        {view === "ledger" ? (
          <LedgerManagementPanel key={store.selectedLedgerId} />
        ) : null}
        {isLocalDevelopment &&
        hasCurrentLedger &&
        !isArchivedLedger &&
        view === "connection" ? (
          <ConnectionPanel />
        ) : null}
        {store.dataError ? (
          <DataError role="alert">{store.dataError}</DataError>
        ) : null}
      </Workspace>

      {hasCurrentLedger && !isArchivedLedger && view === "calendar" ? (
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

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: 0 ${spacing[1]} ${spacing[2]};
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  @media (max-width: 820px) {
    display: none;
  }
`

const BrandMark = styled.div`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: ${radii.sm};
  background: ${colors.ink};
  color: ${colors.panel};
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
  background: ${({ $active }) => ($active ? colors.amberSoft : colors.panel)};
  color: ${({ $active }) => ($active ? colors.amber : colors.muted)};

  &:disabled {
    cursor: default;
  }
`

const LedgerManageButton = styled(Link)`
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border: 1px solid ${colors.borderStrong};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  color: ${colors.muted};
  text-decoration: none;

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
  background: ${colors.panel};
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

const NavButton = styled(Link)<{ $active: boolean }>`
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: ${radii.sm};
  background: ${({ $active }) => ($active ? colors.panelSubtle : "transparent")};
  color: ${({ $active }) => ($active ? colors.ink : colors.muted)};
  padding: 0 10px;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  text-align: left;
  text-decoration: none;
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
    display: none;
  }
`

const Topline = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: ${spacing[5]};

  @media (max-width: 820px) {
    margin-bottom: ${spacing[3]};
  }
`

const MobileAuth = styled.div`
  display: none;

  @media (max-width: 820px) {
    display: block;
    width: min(210px, 48vw);
  }
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
        ? colors.coral
        : $tone === "success"
          ? colors.green
          : colors.border};
  border-radius: ${radii.sm};
  background: ${({ $tone }) =>
    $tone === "error"
      ? colors.coralSoft
      : $tone === "success"
        ? colors.greenSoft
        : colors.panel};
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
