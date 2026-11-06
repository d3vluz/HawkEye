"use client"

import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { VIEWS, type ProcessedImage, type ViewKey } from "@/lib/review"

const URL_BY_VIEW: Record<ViewKey, keyof ProcessedImage> = {
  original: "original_url",
  areas: "areas_url",
  pins: "pins_url",
  boxes: "boxes_url",
  shafts: "shafts_url",
}

export function CaptureViewer({ image, index, total, view, onView, onPrev, onNext }: {
  image: ProcessedImage
  index: number
  total: number
  view: ViewKey
  onView: (v: ViewKey) => void
  onPrev: () => void
  onNext: () => void
}) {
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]

  return (
    <section aria-label="Imagem da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onPrev} disabled={index === 0} aria-label="Captura anterior">
            <ChevronLeft />
          </Button>
          <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-muted-foreground">
            {index + 1} de {total}
          </span>
          <Button variant="ghost" size="icon" onClick={onNext} disabled={index === total - 1} aria-label="Próxima captura">
            <ChevronRight />
          </Button>
          <p className="ml-1 min-w-0 truncate text-sm font-medium text-foreground" title={image.filename}>{image.filename}</p>
        </div>

        <div role="tablist" aria-label="Camada exibida" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => onView(v.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                view === v.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <div className="relative aspect-[17/10] min-h-0 bg-black xl:aspect-auto xl:flex-1">
        <Image
          key={`${image.sha256}-${view}`}
          src={String(image[URL_BY_VIEW[view]])}
          alt={`${current.label} da captura ${image.filename}`}
          fill
          sizes="(min-width: 1280px) 60vw, 100vw"
          className="object-contain"
          priority
        />
      </div>

      <footer className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {current.legend.length === 0 ? (
          <span>Imagem como foi capturada. Use as outras camadas para ver o que o sistema detectou.</span>
        ) : (
          current.legend.map((item) => (
            <span key={item.text} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
              {item.text}
            </span>
          ))
        )}
        <span className="ml-auto hidden lg:inline">Setas ← → trocam de captura</span>
      </footer>
    </section>
  )
}
