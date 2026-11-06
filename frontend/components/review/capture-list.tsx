"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Check, ProcessedImage } from "@/lib/review"

export interface CaptureStatus {
  failing: Check[]
  corrected: boolean
}

export type ListFilter = "all" | "rejected"

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
    <section aria-label="Capturas do lote" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
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
            <span className="tabular-nums text-xs text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma captura reprovada.</li>
        )}
        {visible.map(({ img, index, status }) => {
          const rejected = status.failing.length > 0
          return (
            <li key={img.sha256}>
              <button
                onClick={() => onSelect(index)}
                aria-current={index === selected ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                  index === selected ? "border-primary-emphasis bg-muted" : "border-transparent hover:bg-muted/60"
                )}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <Image src={img.original_url} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                    {status.corrected && <span className="rounded bg-muted px-1 text-[11px] text-foreground">corrigida</span>}
                  </span>
                  <span className="block truncate text-sm font-medium text-foreground">{img.filename}</span>
                  <span className={cn("block truncate text-xs", rejected ? "text-danger-emphasis" : "text-success-emphasis")}>
                    {rejected ? `Reprovada · ${status.failing.map((c) => c.label).join(", ")}` : "Aprovada"}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
