import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { TrustCenter } from "@/features/dashboard/components/TrustCenter"

export default function DataSettingsPage() {
  return (
    <DashboardShell view="trust">
      <TrustCenter />
    </DashboardShell>
  )
}
