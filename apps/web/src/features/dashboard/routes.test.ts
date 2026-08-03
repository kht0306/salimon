import { describe, expect, it } from "vitest"
import {
  dashboardRoutes,
  getLedgerSelectionRoute,
  shouldRedirectToLedgerManagement,
} from "./routes"

describe("dashboard routes", () => {
  it("routes active ledgers to the calendar and archived ledgers to management", () => {
    expect(getLedgerSelectionRoute({})).toBe(dashboardRoutes.calendar)
    expect(getLedgerSelectionRoute(undefined)).toBe(dashboardRoutes.ledger)
    expect(
      getLedgerSelectionRoute({ archivedAt: "2026-08-03T00:00:00.000Z" }),
    ).toBe(dashboardRoutes.ledger)
  })

  it("redirects unavailable ledger screens to ledger management", () => {
    expect(shouldRedirectToLedgerManagement("transactions", undefined)).toBe(
      true,
    )
    expect(
      shouldRedirectToLedgerManagement("calendar", {
        archivedAt: "2026-08-03T00:00:00.000Z",
      }),
    ).toBe(true)
    expect(shouldRedirectToLedgerManagement("ledger", undefined)).toBe(false)
    expect(shouldRedirectToLedgerManagement("settlement", {})).toBe(false)
  })
})
