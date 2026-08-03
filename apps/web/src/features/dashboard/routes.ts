import type { Ledger } from "@salimon/types"

export type DashboardView =
  | "calendar"
  | "transactions"
  | "settlement"
  | "categories"
  | "cards"
  | "accounts"
  | "ledger"
  | "connection"
  | "trust"

export const dashboardRoutes = {
  calendar: "/",
  transactions: "/transactions",
  settlement: "/settlement",
  categories: "/settings/categories",
  cards: "/settings/payment-methods/cards",
  accounts: "/settings/payment-methods/accounts",
  ledger: "/settings/ledgers",
  connection: "/dev/connection",
  trust: "/settings/data",
} satisfies Record<DashboardView, string>

export function getLedgerSelectionRoute(
  ledger: Pick<Ledger, "archivedAt"> | undefined,
): string {
  return !ledger || ledger.archivedAt
    ? dashboardRoutes.ledger
    : dashboardRoutes.calendar
}

export function shouldRedirectToLedgerManagement(
  view: DashboardView,
  ledger: Pick<Ledger, "archivedAt"> | undefined,
): boolean {
  return view !== "ledger" && (!ledger || Boolean(ledger.archivedAt))
}
