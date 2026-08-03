import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { TransactionListPanel } from "@/features/dashboard/components/TransactionListPanel"

export default function TransactionsPage() {
  return (
    <DashboardShell view="transactions">
      <TransactionListPanel />
    </DashboardShell>
  )
}
