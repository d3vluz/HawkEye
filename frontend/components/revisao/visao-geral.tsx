"use client"

// Visão geral de um lote: quantas capturas têm cada defeito e a grade com todas as capturas.

import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { VERIFICACOES } from "@/lib/defeitos"
import { cn } from "@/lib/utils"
import type { Defeito, Defeitos, ItemDeCaptura } from "@/types"
import { PontoDeStatus, descricaoDoStatus } from "./lista-de-capturas"

export function DefeitosNoLote({ defeitos, aoEscolher, className, duasColunas }: {
  defeitos: Defeitos[]
  aoEscolher: (defeito: Defeito) => void
  className?: string
  duasColunas?: boolean
}) {
  const total = defeitos.length
  const contagens = VERIFICACOES.map((v) => ({ verificacao: v, quantidade: defeitos.filter((d) => d[v.defeito]).length }))

  return (
    <section aria-label="Defeitos no lote" className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h2 className="text-sm font-semibold text-foreground">Defeitos no lote</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Quantas capturas têm cada tipo de defeito.</p>
      {contagens.every((c) => c.quantidade === 0) && <p className="mt-4 text-sm text-muted-foreground">Nenhum defeito detectado neste lote.</p>}
      <ul className={cn("mt-3 grid gap-1", duasColunas && "sm:grid-cols-2 sm:gap-x-4")}>
        {contagens.map(({ verificacao, quantidade }) => (
          <li key={verificacao.defeito}>
            <button
              onClick={() => aoEscolher(verificacao.defeito)}
              disabled={quantidade === 0}
              className="group w-full rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default"
            >
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className={cn("font-medium", quantidade ? "text-foreground" : "text-muted-foreground")}>{verificacao.titulo}</span>
                <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                  {quantidade} de {total}
                  {quantidade > 0 && <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />}
                </span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-danger" style={{ width: `${(quantidade / Math.max(total, 1)) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function VisaoGeral({ itens, defeitos, aoAbrir, aoEscolherDefeito }: {
  itens: ItemDeCaptura[]
  defeitos: Defeitos[]
  aoAbrir: (indice: number) => void
  aoEscolherDefeito: (defeito: Defeito) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <DefeitosNoLote defeitos={defeitos} aoEscolher={aoEscolherDefeito} className="h-fit lg:sticky lg:top-0" />

      <section aria-label="Todas as capturas" className="min-h-0">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {itens.map((item, indice) => {
            const reprovada = item.reprovacoes.length > 0
            return (
              <li key={item.chave}>
                <button
                  onClick={() => aoAbrir(indice)}
                  className="w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary-emphasis/60"
                >
                  <span className="relative block aspect-[17/10] bg-black">
                    <Image src={item.imagens.original} alt="" fill sizes="(min-width: 1536px) 20vw, (min-width: 640px) 40vw, 100vw" className="object-contain" />
                    <span className="absolute top-2 left-2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                      {indice + 1}
                    </span>
                  </span>
                  <span className="block p-3">
                    <span className="block truncate text-sm font-medium text-foreground" title={item.nome}>{item.nome}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PontoDeStatus reprovada={reprovada} />
                      <span className="truncate">{reprovada ? `Reprovada · ${descricaoDoStatus(item)}` : "Aprovada"}</span>
                    </span>
                    {item.corrigida && <span className="mt-0.5 block text-[11px] text-primary-emphasis">Corrigida na revisão</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
