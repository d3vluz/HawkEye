"use client"

// Lista das capturas de um lote com o status de cada uma e o filtro de reprovadas.

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ItemDeCaptura } from "@/types"

export type Filtro = "todas" | "reprovadas"

export function PontoDeStatus({ reprovada }: { reprovada: boolean }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", reprovada ? "bg-danger" : "bg-success")} />
}

export const descricaoDoStatus = (item: ItemDeCaptura) => item.reprovacoes.join(", ") || "Aprovada"

export function ListaDeCapturas({ itens, selecionada, filtro, aoFiltrar, aoSelecionar }: {
  itens: ItemDeCaptura[]
  selecionada: number
  filtro: Filtro
  aoFiltrar: (filtro: Filtro) => void
  aoSelecionar: (indice: number) => void
}) {
  const reprovadas = itens.filter((i) => i.reprovacoes.length > 0).length
  const visiveis = itens
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => filtro === "todas" || item.reprovacoes.length > 0)

  return (
    <section aria-label="Capturas do lote" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="flex gap-1 border-b border-border p-2" role="tablist" aria-label="Filtrar capturas">
        {([["todas", "Todas", itens.length], ["reprovadas", "Reprovadas", reprovadas]] as const).map(([chave, rotulo, quantidade]) => (
          <button
            key={chave}
            role="tab"
            aria-selected={filtro === chave}
            onClick={() => aoFiltrar(chave)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              filtro === chave ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {rotulo}
            <span className="text-xs tabular-nums text-muted-foreground">{quantidade}</span>
          </button>
        ))}
      </div>

      {/* Abaixo de lg vira uma faixa horizontal para não empurrar a imagem para fora da tela. */}
      <ol className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
        {visiveis.length === 0 && (
          <li className="w-full px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma captura reprovada.</li>
        )}
        {visiveis.map(({ item, indice }) => (
          <li key={item.chave} className="w-56 shrink-0 lg:w-auto">
            <button
              onClick={() => aoSelecionar(indice)}
              aria-current={indice === selecionada ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                indice === selecionada ? "border-primary-emphasis/60 bg-muted" : "border-transparent hover:bg-muted/60"
              )}
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                <Image src={item.imagens.original} alt="" fill sizes="48px" className="object-cover" />
                <span className="absolute bottom-0 left-0 rounded-tr bg-background/85 px-1 text-[10px] font-medium tabular-nums text-foreground">
                  {indice + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground" title={item.nome}>{item.nome}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PontoDeStatus reprovada={item.reprovacoes.length > 0} />
                  <span className="truncate">{descricaoDoStatus(item)}</span>
                </span>
                {item.corrigida && <span className="mt-0.5 block text-[11px] text-primary-emphasis">Corrigida na revisão</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
