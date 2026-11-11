"use client"

// Imagem da captura com navegação entre capturas, troca de camada e legenda das cores de cada camada.

import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Camada, ItemDeCaptura } from "@/types"

// As cores repetem as que o worker desenha em cada imagem anotada.
const CAMADAS: Array<{ camada: Camada; rotulo: string; legenda: Array<{ cor: string; texto: string }> }> = [
  { camada: "original", rotulo: "Original", legenda: [] },
  {
    camada: "areas", rotulo: "Grade", legenda: [
      { cor: "#d946ef", texto: "Divisória vertical" },
      { cor: "#22c55e", texto: "Divisória horizontal" },
      { cor: "#ef4444", texto: "Divisória ausente" },
    ],
  },
  {
    camada: "pins", rotulo: "Pinos", legenda: [
      { cor: "#22c55e", texto: "Pino conforme" },
      { cor: "#f59e0b", texto: "Cor errada ou deformado" },
      { cor: "#ef4444", texto: "Cor errada e deformado" },
    ],
  },
  {
    camada: "boxes", rotulo: "Compartimentos", legenda: [
      { cor: "#22c55e", texto: "Com o pino esperado" },
      { cor: "#ef4444", texto: "Vazio" },
      { cor: "#f59e0b", texto: "Pino a mais" },
    ],
  },
  {
    camada: "shafts", rotulo: "Hastes", legenda: [
      { cor: "#22c55e", texto: "Haste íntegra" },
      { cor: "#ef4444", texto: "Quebrada, curta ou torta (círculo no pino)" },
    ],
  },
]

export function Visualizador({ item, indice, total, camada, aoTrocarCamada, aoVoltar, aoAvancar }: {
  item: ItemDeCaptura
  indice: number
  total: number
  camada: Camada
  aoTrocarCamada: (camada: Camada) => void
  aoVoltar: () => void
  aoAvancar: () => void
}) {
  const atual = CAMADAS.find((c) => c.camada === camada) ?? CAMADAS[0]

  return (
    <section aria-label="Imagem da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={aoVoltar} disabled={indice === 0} aria-label="Captura anterior">
            <ChevronLeft />
          </Button>
          <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-muted-foreground">
            {indice + 1} de {total}
          </span>
          <Button variant="ghost" size="icon" onClick={aoAvancar} disabled={indice === total - 1} aria-label="Próxima captura">
            <ChevronRight />
          </Button>
          <p className="ml-1 min-w-0 truncate text-sm font-medium text-foreground" title={item.nome}>{item.nome}</p>
        </div>

        <div role="tablist" aria-label="Camada exibida" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {CAMADAS.map((c) => (
            <button
              key={c.camada}
              role="tab"
              aria-selected={camada === c.camada}
              onClick={() => aoTrocarCamada(c.camada)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                camada === c.camada ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
      </header>

      <div className="relative aspect-[17/10] min-h-0 bg-black xl:aspect-auto xl:flex-1">
        <Image
          key={`${item.chave}-${camada}`}
          src={item.imagens[camada]}
          alt={`${atual.rotulo} da captura ${item.nome}`}
          fill
          sizes="(min-width: 1280px) 60vw, 100vw"
          className="object-contain"
          priority
        />
      </div>

      <footer className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {atual.legenda.length === 0 ? (
          <span>Imagem como foi capturada. Use as outras camadas para ver o que o sistema detectou.</span>
        ) : (
          atual.legenda.map((l) => (
            <span key={l.texto} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: l.cor }} aria-hidden />
              {l.texto}
            </span>
          ))
        )}
        <span className="ml-auto hidden lg:inline">Setas ← → trocam de captura</span>
      </footer>
    </section>
  )
}
