import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { SettlementPanel } from "@/features/dashboard/components/SettlementPanel"

export default function SettlementPage() {
  return (
    <DashboardShell view="settlement">
      <SettlementPanel />
    </DashboardShell>
  )
}
