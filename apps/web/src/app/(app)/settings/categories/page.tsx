import { DashboardShell } from "@/features/dashboard/DashboardShell"
import { CategoryManager } from "@/features/dashboard/components/CategoryManager"

export default function CategoriesPage() {
  return (
    <DashboardShell view="categories">
      <CategoryManager />
    </DashboardShell>
  )
}
