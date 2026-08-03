import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { CalendarGrid } from "@/features/dashboard/components/CalendarGrid"
import { TransactionPanel } from "@/features/dashboard/components/TransactionPanel"

export default function Home() {
  return (
    <DashboardShell view="calendar" sidePanel={<TransactionPanel />}>
      <CalendarGrid />
    </DashboardShell>
  )
}
