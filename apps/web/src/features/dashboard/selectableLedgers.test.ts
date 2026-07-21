import { AppStore } from "@salimon/store"
import type { Ledger, LedgerMember } from "@salimon/types"
import { describe, expect, it } from "vitest"

const createLedger = (id: string, archivedAt?: string): Ledger => ({
  id,
  ownerId: "user-1",
  name: id,
  type: "personal",
  currency: "KRW",
  role: "owner",
  archivedAt,
})

const createMembership = (
  ledgerId: string,
  isDefault: boolean,
): LedgerMember => ({
  id: `member-${ledgerId}`,
  ledgerId,
  userId: "user-1",
  nickname: "사용자",
  role: "owner",
  status: "active",
  isDefault,
  joinedAt: "2026-07-21T00:00:00.000Z",
})

describe("AppStore.selectableLedgers", () => {
  it("places the default ledger first and archived ledgers last", () => {
    const store = new AppStore()
    store.authUser = { id: "user-1", nickname: "사용자" }
    store.data.ledgers = [
      createLedger("archived-1", "2026-07-20T00:00:00.000Z"),
      createLedger("active-1"),
      createLedger("default"),
      createLedger("archived-2", "2026-07-21T00:00:00.000Z"),
      createLedger("active-2"),
    ]
    store.data.members = [
      createMembership("active-1", false),
      createMembership("default", true),
    ]

    expect(store.selectableLedgers.map((ledger) => ledger.id)).toEqual([
      "default",
      "active-1",
      "active-2",
      "archived-1",
      "archived-2",
    ])
  })
})
