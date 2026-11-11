// Área do funcionário: inspeção, revisão e coletas usam o menu lateral do funcionário.

import type { ReactNode } from "react"
import { LayoutDoApp } from "@/components/layout-do-app"

export default function LayoutDoFuncionario({ children }: { children: ReactNode }) {
  return <LayoutDoApp perfil="EMPLOYEE">{children}</LayoutDoApp>
}
