import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { LedgerManagementPanel } from "@/features/dashboard/components/LedgerManagementPanel"

export default function LedgersPage() {
  return (
    <DashboardShell view="ledger">
      <LedgerManagementPanel />
    </DashboardShell>
  )
}
