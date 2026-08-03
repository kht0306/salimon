import { StoreProvider } from "@/features/dashboard/StoreProvider"

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <StoreProvider>{children}</StoreProvider>
}
