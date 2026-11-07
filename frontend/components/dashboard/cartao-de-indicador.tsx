// Cartão de um indicador do dashboard: valor, variação em relação ao período anterior e minigráfico.

import { useId, type ReactNode } from "react"
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Tom = "signal" | "success" | "warning" | "danger"

const TONS: Record<Tom, { selo: string; traco: string; preenchimento: string }> = {
  signal: { selo: "bg-signal/12 text-signal", traco: "var(--signal)", preenchimento: "color-mix(in oklch, var(--signal) 14%, transparent)" },
  success: { selo: "bg-success/12 text-success-emphasis", traco: "var(--success)", preenchimento: "color-mix(in oklch, var(--success) 14%, transparent)" },
  warning: { selo: "bg-warning/14 text-warning-emphasis", traco: "var(--warning)", preenchimento: "color-mix(in oklch, var(--warning) 16%, transparent)" },
  danger: { selo: "bg-danger/12 text-danger-emphasis", traco: "var(--danger)", preenchimento: "color-mix(in oklch, var(--danger) 14%, transparent)" },
}

export interface Variacao {
  rotulo: string
  subiu: boolean
  melhorou: boolean
}

function Ajuda({ texto }: { texto: string }) {
  const id = useId()
  return (
    <span className="group relative">
      <button
        type="button"
        aria-describedby={id}
        aria-label="O que é esta métrica"
        className="flex size-5 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full right-0 z-20 mt-2 w-60 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {texto}
      </span>
    </span>
  )
}

// Dias sem lote viram lacuna; repetir o último valor mantém a linha contínua sem inventar queda a zero.
function preencherLacunas(valores: Array<number | null>) {
  let ultimo = valores.find((v) => v !== null) ?? null
  return valores.map((v) => (v === null ? ultimo : (ultimo = v)))
}

export function MiniGrafico({ valores, tom }: { valores: Array<number | null>; tom: Tom }) {
  const preenchidos = preencherLacunas(valores)
  if (preenchidos.every((v) => v === null)) return <div className="h-12 border-b border-dashed border-border" aria-hidden />

  const pontos = preenchidos as number[]
  const maximo = Math.max(...pontos)
  const minimo = Math.min(...pontos)
  const largura = 100
  const altura = 40
  const coordenadas = pontos.map((v, i) => [
    (i / Math.max(pontos.length - 1, 1)) * largura,
    maximo === minimo ? altura / 2 : altura - 4 - ((v - minimo) / (maximo - minimo)) * (altura - 8),
  ])
  const linha = coordenadas.map(([x, y]) => `${x},${y}`).join(" ")
  const { traco, preenchimento } = TONS[tom]

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <polygon points={`0,${altura} ${linha} ${largura},${altura}`} fill={preenchimento} />
      <polyline points={linha} fill="none" stroke={traco} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function CartaoDeIndicador({ icone: Icone, tom, titulo, ajuda, valor, variacao, legenda, grafico, rodape }: {
  icone: LucideIcon
  tom: Tom
  titulo: string
  ajuda: string
  valor: string
  variacao?: Variacao | null
  legenda: ReactNode
  grafico: ReactNode
  rodape: ReactNode
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONS[tom].selo)}>
          <Icone className="size-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm leading-tight font-semibold text-foreground">{titulo}</h3>
        <Ajuda texto={ajuda} />
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{valor}</p>
        {variacao && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              variacao.melhorou ? "bg-success/12 text-success-emphasis" : "bg-danger/12 text-danger-emphasis"
            )}
          >
            {variacao.subiu ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {variacao.rotulo}
            <span className="sr-only">{variacao.melhorou ? " (melhora)" : " (piora)"} em relação ao período anterior</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{legenda}</p>

      <div className="mt-4">{grafico}</div>

      <footer className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{rodape}</footer>
    </article>
  )
}
