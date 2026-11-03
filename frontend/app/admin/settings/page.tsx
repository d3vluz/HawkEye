"use client"

import { useEffect, useState } from "react"
import { Activity, Building2, ChevronRight, HardDrive, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { UnitsSection } from "@/components/settings/units-section"
import { InspectionSection } from "@/components/settings/inspection-section"
import { StorageSection } from "@/components/settings/storage-section"
import { StatusSection } from "@/components/settings/status-section"
import { cn } from "@/lib/utils"

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon; Component: () => React.JSX.Element }> = [
  { id: "unidades", label: "Unidades", icon: Building2, Component: UnitsSection },
  { id: "criterios", label: "Critérios de inspeção", icon: SlidersHorizontal, Component: InspectionSection },
  { id: "armazenamento", label: "Armazenamento", icon: HardDrive, Component: StorageSection },
  { id: "status", label: "Status do sistema", icon: Activity, Component: StatusSection },
]

export default function ConfiguracoesPage() {
  const [active, setActive] = useState(SECTIONS[0].id)

  // A seção fica no hash para o link e o voltar do navegador abrirem a mesma aba.
  useEffect(() => {
    const sync = () => {
      const fromHash = window.location.hash.slice(1)
      if (SECTIONS.some((s) => s.id === fromHash)) setActive(fromHash)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">CONFIGURAÇÕES</span>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Linhas de produção, padrão de qualidade e saúde da plataforma.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Seções de configurações" className="lg:sticky lg:top-8 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={id === current.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    id === current.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <current.Component key={current.id} />
      </div>
    </div>
  )
}
