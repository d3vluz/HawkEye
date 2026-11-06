"use client"

import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHECKS, type DefectKey, type Flags, type ProcessedImage } from "@/lib/review"
import { StatusDot, statusText, type CaptureStatus } from "./capture-list"

export function DefectSummary({ flags, onSelect, className, twoColumns }: {
  flags: Flags[]
  onSelect: (key: DefectKey) => void
  className?: string
  twoColumns?: boolean
}) {
  const total = flags.length
  const defects = CHECKS.map((check) => ({ check, count: flags.filter((f) => f[check.key]).length }))
  const anyDefect = defects.some((d) => d.count > 0)

  return (
    <section aria-label="Defeitos no lote" className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h2 className="text-sm font-semibold text-foreground">Defeitos no lote</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Quantas capturas têm cada tipo de defeito.</p>
        {!anyDefect && <p className="mt-4 text-sm text-muted-foreground">Nenhum defeito detectado neste lote.</p>}
        <ul className={cn("mt-3 grid gap-1", twoColumns && "sm:grid-cols-2 sm:gap-x-4")}>
          {defects.map(({ check, count }) => (
            <li key={check.key}>
              <button
                onClick={() => onSelect(check.key)}
                disabled={count === 0}
                className="group w-full rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default"
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn("font-medium", count ? "text-foreground" : "text-muted-foreground")}>{check.label}</span>
                  <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                    {count} de {total}
                    {count > 0 && <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />}
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-danger" style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
  )
}

export function LotOverview({ images, statuses, flags, onOpen, onOpenDefect }: {
  images: ProcessedImage[]
  statuses: CaptureStatus[]
  flags: Flags[]
  onOpen: (index: number) => void
  onOpenDefect: (key: DefectKey) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <DefectSummary flags={flags} onSelect={onOpenDefect} className="h-fit lg:sticky lg:top-0" />

      <section aria-label="Todas as capturas" className="min-h-0">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {images.map((img, index) => {
            const status = statuses[index]
            const rejected = status.failing.length > 0
            return (
              <li key={img.sha256}>
                <button
                  onClick={() => onOpen(index)}
                  className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary-emphasis/60"
                >
                  <span className="relative block aspect-[17/10] bg-black">
                    <Image src={img.original_url} alt="" fill sizes="(min-width: 1536px) 20vw, (min-width: 640px) 40vw, 100vw" className="object-contain" />
                    <span className="absolute top-2 left-2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground">
                      {index + 1}
                    </span>
                  </span>
                  <span className="block p-3">
                    <span className="block truncate text-sm font-medium text-foreground" title={img.filename}>{img.filename}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusDot rejected={rejected} />
                      <span className="truncate">{rejected ? `Reprovada · ${statusText(status)}` : "Aprovada"}</span>
                    </span>
                    {status.corrected && <span className="mt-0.5 block text-[11px] text-primary-emphasis">Corrigida por você</span>}
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
