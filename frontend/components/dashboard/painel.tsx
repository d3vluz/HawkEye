// Moldura comum dos blocos do dashboard (título, descrição, ação) e o estado vazio de cada bloco.

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Painel({ titulo, descricao, acao, className, children }: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </header>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </section>
  )
}

export function PainelVazio({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      {icone}
      <p className="mt-3 text-sm font-medium text-foreground">{titulo}</p>
      {children && <p className="mt-1 max-w-xs text-xs text-pretty text-muted-foreground">{children}</p>}
    </div>
  )
}
