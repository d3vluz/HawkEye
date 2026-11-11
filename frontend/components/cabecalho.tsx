// Cabeçalho de página: trilha de navegação (›), título, descrição e ações à direita.

import { Fragment, type ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface Etapa {
  rotulo: string
  href?: string
}

export function Cabecalho({ trilha, titulo, descricao, acoes }: {
  trilha: Etapa[]
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Trilha de navegação" className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {trilha.map((etapa, i) => {
            const ultima = i === trilha.length - 1
            return (
              <Fragment key={`${etapa.rotulo}-${i}`}>
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {ultima ? (
                  <span aria-current="page" className="max-w-[40ch] truncate text-foreground">{etapa.rotulo}</span>
                ) : etapa.href ? (
                  <Link href={etapa.href} className="transition-colors hover:text-foreground">{etapa.rotulo}</Link>
                ) : (
                  <span>{etapa.rotulo}</span>
                )}
              </Fragment>
            )
          })}
        </nav>
        <h1 className="truncate text-3xl font-bold text-foreground">{titulo}</h1>
        {descricao && <div className="mt-2 text-sm text-muted-foreground">{descricao}</div>}
      </div>
      {acoes && <div className="flex shrink-0 flex-col items-end gap-1">{acoes}</div>}
    </header>
  )
}
