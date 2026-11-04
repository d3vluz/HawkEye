import { useId, type ReactNode } from "react"
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Tone = "signal" | "success" | "warning" | "danger"

const TONES: Record<Tone, { chip: string; stroke: string; fill: string }> = {
  signal: { chip: "bg-signal/12 text-signal", stroke: "var(--signal)", fill: "color-mix(in oklch, var(--signal) 14%, transparent)" },
  success: { chip: "bg-success/12 text-success-emphasis", stroke: "var(--success)", fill: "color-mix(in oklch, var(--success) 14%, transparent)" },
  warning: { chip: "bg-warning/14 text-warning-emphasis", stroke: "var(--warning)", fill: "color-mix(in oklch, var(--warning) 16%, transparent)" },
  danger: { chip: "bg-danger/12 text-danger-emphasis", stroke: "var(--danger)", fill: "color-mix(in oklch, var(--danger) 14%, transparent)" },
}

export interface Delta {
  label: string
  direction: "up" | "down"
  good: boolean
}

function HelpHint({ text }: { text: string }) {
  const id = useId()
  return (
    <span className="group relative">
      <button
        type="button"
        aria-describedby={id}
        aria-label="O que é esta métrica"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

// Dias sem lote viram lacuna; repetir o último valor mantém a linha contínua sem inventar queda a zero.
function fillGaps(values: Array<number | null>) {
  let last = values.find((v) => v !== null) ?? null
  return values.map((v) => (v === null ? last : (last = v)))
}

export function Sparkline({ values, tone }: { values: Array<number | null>; tone: Tone }) {
  const filled = fillGaps(values)
  if (filled.every((v) => v === null)) {
    return <div className="h-12 border-b border-dashed border-border" aria-hidden />
  }
  const points = filled as number[]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const width = 100
  const height = 40
  const coords = points.map((v, i) => [
    (i / Math.max(points.length - 1, 1)) * width,
    max === min ? height / 2 : height - 4 - ((v - min) / span) * (height - 8),
  ])
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `0,${height} ${line} ${width},${height}`
  const { stroke, fill } = TONES[tone]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <polygon points={area} fill={fill} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiCard({ icon: Icon, tone, title, help, value, delta, caption, chart, footer }: {
  icon: LucideIcon
  tone: Tone
  title: string
  help: string
  value: string
  delta?: Delta | null
  caption: ReactNode
  chart: ReactNode
  footer: ReactNode
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONES[tone].chip)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground">{title}</h3>
        <HelpHint text={help} />
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              delta.good ? "bg-success/12 text-success-emphasis" : "bg-danger/12 text-danger-emphasis"
            )}
          >
            {delta.direction === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {delta.label}
            <span className="sr-only">{delta.good ? " (melhora)" : " (piora)"} em relação ao período anterior</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>

      <div className="mt-4">{chart}</div>

      <footer className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{footer}</footer>
    </article>
  )
}
