import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell role="ADMIN">{children}</AppShell>
}
