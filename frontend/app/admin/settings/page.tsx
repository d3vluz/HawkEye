"use client"

// Configurações do admin: linhas de produção, critérios de inspeção, armazenamento e status dos serviços.

import { useEffect, useState } from "react"
import { Activity, Building2, HardDrive, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { SecaoDeArmazenamento } from "@/components/configuracoes/armazenamento"
import { SecaoDeCriterios } from "@/components/configuracoes/criterios"
import { SecaoDeLinhas } from "@/components/configuracoes/linhas"
import { SecaoDeStatus } from "@/components/configuracoes/status"
import { cn } from "@/lib/utils"

const SECOES: Array<{ id: string; rotulo: string; icone: LucideIcon; Conteudo: () => React.JSX.Element }> = [
  { id: "linhas", rotulo: "Linhas de produção", icone: Building2, Conteudo: SecaoDeLinhas },
  { id: "criterios", rotulo: "Critérios de inspeção", icone: SlidersHorizontal, Conteudo: SecaoDeCriterios },
  { id: "armazenamento", rotulo: "Armazenamento", icone: HardDrive, Conteudo: SecaoDeArmazenamento },
  { id: "status", rotulo: "Status do sistema", icone: Activity, Conteudo: SecaoDeStatus },
]

export default function PaginaDeConfiguracoes() {
  const [ativa, setAtiva] = useState(SECOES[0].id)
  
  useEffect(() => {
    const sincronizar = () => {
      const doHash = window.location.hash.slice(1)
      if (SECOES.some((s) => s.id === doHash)) setAtiva(doHash)
    }
    sincronizar()
    window.addEventListener("hashchange", sincronizar)
    return () => window.removeEventListener("hashchange", sincronizar)
  }, [])

  const atual = SECOES.find((s) => s.id === ativa) ?? SECOES[0]

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <Cabecalho
        trilha={[{ rotulo: "Admin", href: "/admin" }, { rotulo: "Configurações" }]}
        titulo="Configurações"
        descricao="Linhas de produção, padrão de qualidade e saúde da plataforma."
      />

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Seções de configurações" className="lg:sticky lg:top-8 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECOES.map(({ id, rotulo, icone: Icone }) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={id === atual.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    id === atual.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icone className="size-4 shrink-0" /> {rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <atual.Conteudo key={atual.id} />
      </div>
    </div>
  )
}
