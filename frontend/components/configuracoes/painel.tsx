// Moldura das seções de configurações (título, descrição, ação e rodapé) e a mensagem de carregando/erro.

import type { ReactNode } from "react"

export function PainelDeConfiguracao({ titulo, descricao, acao, rodape, children }: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-prose">
          <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-1 text-sm text-pretty text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </header>
      <div className="p-6">{children}</div>
      {rodape && <footer className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">{rodape}</footer>}
    </section>
  )
}

export function Aviso({ children, erro = false }: { children: ReactNode; erro?: boolean }) {
  return (
    <p role={erro ? "alert" : undefined} className={erro ? "text-sm text-danger-emphasis" : "text-sm text-muted-foreground"}>
      {children}
    </p>
  )
}
