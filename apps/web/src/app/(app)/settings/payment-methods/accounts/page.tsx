import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { AccountManager } from "@/features/dashboard/components/AccountManager"

export default function AccountsPage() {
  return (
    <DashboardShell view="accounts">
      <AccountManager />
    </DashboardShell>
  )
}
