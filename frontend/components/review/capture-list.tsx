"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Check, ProcessedImage } from "@/lib/review"

export interface CaptureStatus {
  failing: Check[]
  corrected: boolean
}

export type ListFilter = "all" | "rejected"

export function StatusDot({ rejected, className }: { rejected: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", rejected ? "bg-danger" : "bg-success", className)} />
}

export function statusText(status: CaptureStatus) {
  return status.failing.length > 0 ? status.failing.map((c) => c.label).join(", ") : "Aprovada"
}

export function CaptureList({ images, statuses, selected, filter, onFilter, onSelect }: {
  images: ProcessedImage[]
  statuses: CaptureStatus[]
  selected: number
  filter: ListFilter
  onFilter: (f: ListFilter) => void
  onSelect: (index: number) => void
}) {
  const rejectedCount = statuses.filter((s) => s.failing.length > 0).length
  const visible = images
    .map((img, index) => ({ img, index, status: statuses[index] }))
    .filter(({ status }) => filter === "all" || status.failing.length > 0)

  return (
    <section aria-label="Capturas do lote" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="flex gap-1 border-b border-border p-2" role="tablist" aria-label="Filtrar capturas">
        {([["all", "Todas", images.length], ["rejected", "Reprovadas", rejectedCount]] as const).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => onFilter(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              filter === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {/* Abaixo de lg vira uma faixa horizontal para não empurrar a imagem para fora da tela. */}
      <ol className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
        {visible.length === 0 && (
          <li className="w-full px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma captura reprovada.</li>
        )}
        {visible.map(({ img, index, status }) => {
          const rejected = status.failing.length > 0
          const active = index === selected
          return (
            <li key={img.sha256} className="w-56 shrink-0 lg:w-auto">
              <button
                onClick={() => onSelect(index)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                  active ? "border-primary-emphasis/60 bg-muted" : "border-transparent hover:bg-muted/60"
                )}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <Image src={img.original_url} alt="" fill sizes="48px" className="object-cover" />
                  <span className="absolute bottom-0 left-0 rounded-tr bg-background/85 px-1 text-[10px] font-medium tabular-nums text-foreground">
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground" title={img.filename}>{img.filename}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusDot rejected={rejected} />
                    <span className="truncate">{statusText(status)}</span>
                  </span>
                  {status.corrected && <span className="mt-0.5 block text-[11px] text-primary-emphasis">Corrigida por você</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
