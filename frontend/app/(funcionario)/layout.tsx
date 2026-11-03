import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <AppShell role="EMPLOYEE">{children}</AppShell>
}
