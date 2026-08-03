import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { ConnectionPanel } from "@/features/dashboard/components/ConnectionPanel"

export default function ConnectionPage() {
  return (
    <DashboardShell view="connection">
      <ConnectionPanel />
    </DashboardShell>
  )
}
