import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { CardManager } from "@/features/dashboard/components/CardManager"

export default function CardsPage() {
  return (
    <DashboardShell view="cards">
      <CardManager />
    </DashboardShell>
  )
}
