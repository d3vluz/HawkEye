// Área do admin: todas as páginas usam o menu lateral com as opções de administração.

import type { ReactNode } from "react"
import { LayoutDoApp } from "@/components/layout-do-app"

export default function LayoutDoAdmin({ children }: { children: ReactNode }) {
  return <LayoutDoApp perfil="ADMIN">{children}</LayoutDoApp>
}
