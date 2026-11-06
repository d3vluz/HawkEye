"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Download, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader, type Crumb } from "@/components/page-header"
import { CaptureList, StatusDot, type ListFilter } from "@/components/review/capture-list"
import { CaptureViewer } from "@/components/review/capture-viewer"
import { DefectSummary } from "@/components/review/lot-overview"
import { getInspectionSettings, type Batch, type Capture } from "@/lib/api-client"
import { CHECKS, type DefectKey, type Flags, type ProcessedImage, type ViewKey } from "@/lib/review"
import { cn } from "@/lib/utils"

interface BatchDetailProps {
  id: string
  load: (id: string) => Promise<{ batch: Batch; captures: Capture[] }>
  crumbs: Crumb[]
}

const CORRECTION_TEXT = (detected: boolean, corrected: boolean) =>
  `Corrigido na revisão: o sistema indicou ${detected ? "defeito" : "OK"} e o operador marcou ${corrected ? "defeito" : "OK"}.`

function flagsOf(c: Capture): Flags {
  return {
    missing: Boolean(c.hasMissingPins),
    extra: Boolean(c.hasExtraPins),
    wrongColor: Boolean(c.hasWrongColorPins),
    damaged: Boolean(c.hasDamagedPins),
    shaft: Boolean(c.hasShaftDefects),
    structure: Boolean(c.hasStructureDamage),
  }
}

// O visualizador e a lista da revisão esperam o formato do worker; a captura salva só muda os nomes.
function asImage(c: Capture): ProcessedImage {
  const original = c.original_uri
  return {
    filename: c.filename,
    sha256: c.sha256 ?? c.id,
    original_url: original,
    areas_url: c.processed_areas_uri || original,
    pins_url: c.processed_pins_uri || original,
    boxes_url: c.processed_uri || original,
    shafts_url: c.processed_shaft_uri || original,
  } as ProcessedImage
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function CaptureFindings({ capture, flags, view, onView }: {
  capture: Capture
  flags: Flags
  view: ViewKey
  onView: (v: ViewKey) => void
}) {
  const failing = CHECKS.filter((c) => flags[c.key])
  const corrections = new Map((capture.corrections ?? []).map((c) => [c.defect, c]))

  return (
    <section aria-label="Resultado da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          {capture.is_valid ? <CheckCircle2 className="size-5 text-success-emphasis" /> : <XCircle className="size-5 text-danger-emphasis" />}
          <h2 className="text-base font-semibold text-foreground">{capture.is_valid ? "Captura aprovada" : "Captura reprovada"}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {failing.length > 0
            ? `${capture.is_valid ? "Tolerado pelos critérios" : "Motivo"}: ${failing.map((c) => c.label.toLowerCase()).join(", ")}.`
            : "Nenhum defeito registrado."}
        </p>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-2 py-1">
        {CHECKS.map((check) => {
          const value = flags[check.key]
          const correction = corrections.get(check.key)
          return (
            <li key={check.key} className="py-1">
              <button
                onClick={() => onView(check.view)}
                title="Mostrar a camada correspondente"
                className={cn("flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50", view === check.view && "bg-muted/50")}
              >
                <span className="mt-0.5">
                  {value ? <CircleAlert className="size-4 text-danger-emphasis" /> : <CheckCircle2 className="size-4 text-success-emphasis" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{check.label}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{value ? "Defeito registrado" : check.clear}</span>
                  {correction && (
                    <span className="block text-xs leading-relaxed text-primary-emphasis">
                      {CORRECTION_TEXT(correction.detected, correction.corrected)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function BatchDetail({ id, load, crumbs }: BatchDetailProps) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [target, setTarget] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<ViewKey>("original")
  const [filter, setFilter] = useState<ListFilter>("all")
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const loadBatch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await load(id)
      setBatch(data.batch)
      setCaptures(data.captures)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o lote.")
    } finally {
      setLoading(false)
    }
  }, [id, load])

  useEffect(() => { loadBatch() }, [loadBatch])
  useEffect(() => {
    getInspectionSettings().then((s) => setTarget(s.minQualityScore)).catch(() => setTarget(null))
  }, [])

  const images = useMemo(() => captures.map(asImage), [captures])
  const flags = useMemo(() => captures.map(flagsOf), [captures])
  const statuses = useMemo(() => captures.map((c, i) => ({
    failing: c.is_valid ? [] : CHECKS.filter((check) => flags[i][check.key]),
    corrected: Boolean(c.corrections?.length),
  })), [captures, flags])

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(captures.length - 1, next))), [captures.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, select, [role=listbox]")) return
      if (event.key === "ArrowRight") go(index + 1)
      if (event.key === "ArrowLeft") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, index])

  const downloadImages = async () => {
    if (!batch) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      for (const capture of captures) {
        const folder = zip.folder(capture.filename.replace(/\.[^.]+$/, "") || capture.id)
        if (!folder) continue
        const files = [
          [capture.original_uri, "original"],
          [capture.processed_areas_uri, "grade"],
          [capture.processed_pins_uri, "pinos"],
          [capture.processed_uri, "compartimentos"],
          [capture.processed_shaft_uri, "hastes"],
        ] as const
        for (const [url, name] of files) {
          if (!url) continue
          const res = await fetch(url).catch(() => null)
          if (res?.ok) folder.file(`${name}.png`, await res.blob())
        }
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `${batch.name.replace(/\s+/g, "_")}.zip`
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      setDownloadError("Não foi possível baixar as imagens. Tente novamente.")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const parent = crumbs[crumbs.length - 1]

  if (error || !batch) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-8 text-danger-emphasis" />
        <p className="font-medium text-foreground">Não foi possível abrir o lote</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        {parent?.href && <Button variant="outline" asChild><Link href={parent.href}><ArrowLeft /> Voltar para {parent.label.toLowerCase()}</Link></Button>}
      </div>
    )
  }

  const total = batch.total_captures
  const approved = batch.valid_captures ?? captures.filter((c) => c.is_valid).length
  const rejected = batch.invalid_captures ?? total - approved
  const corrected = statuses.filter((s) => s.corrected).length
  const quality = batch.quality_score ?? (total ? (approved / total) * 100 : 0)
  const belowTarget = target !== null && quality < target
  const capture = captures[index]

  const openDefect = (key: DefectKey) => {
    const first = flags.findIndex((f) => f[key])
    if (first < 0) return
    setFilter("all")
    setView(CHECKS.find((c) => c.key === key)?.view ?? "original")
    setIndex(first)
    document.getElementById("inspecao-capturas")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const meta = [
    batch.unit ? batch.unit.name : null,
    batch.author ? `Coletado por ${batch.author.name ?? "membro removido"} · matrícula ${batch.author.matricula}` : null,
    formatDate(batch.created_at),
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        crumbs={[...crumbs, { label: "Detalhes" }]}
        title={batch.name}
        description={
          <>
            <p>{meta.join(" · ")}</p>
            {batch.description && <p className="mt-2 max-w-2xl text-foreground">{batch.description}</p>}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={downloadImages} disabled={downloading || captures.length === 0}>
              {downloading ? <Loader2 className="animate-spin" /> : <Download />}
              {downloading ? "Baixando..." : "Baixar imagens"}
            </Button>
            {downloadError && <p role="alert" className="text-xs text-danger-emphasis">{downloadError}</p>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Resultado do lote" className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Resultado do lote</h2>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-bold tracking-tight tabular-nums text-foreground">{quality.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-muted-foreground">das capturas aprovadas</p>
            </div>
            {target !== null && (
              <p className={cn("text-right text-sm", belowTarget ? "text-danger-emphasis" : "text-success-emphasis")}>
                {belowTarget ? "Abaixo" : "Dentro"} da meta de {target}%
              </p>
            )}
          </div>
          <div className="relative mt-3 h-2 rounded-full bg-muted">
            <div className={cn("h-full rounded-full", belowTarget ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(quality, 100)}%` }} />
            {target !== null && <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60" style={{ left: `${target}%` }} title={`Meta: ${target}%`} />}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Capturas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{total}</dd></div>
            <div><dt className="flex items-center gap-1.5 text-muted-foreground"><StatusDot rejected={false} />Aprovadas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{approved}</dd></div>
            <div><dt className="flex items-center gap-1.5 text-muted-foreground"><StatusDot rejected />Reprovadas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{rejected}</dd></div>
            <div><dt className="text-muted-foreground">Corrigidas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{corrected}</dd></div>
          </dl>
        </section>
        <DefectSummary flags={flags} onSelect={openDefect} twoColumns />
      </div>

      {captures.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Este lote não tem capturas.</p>
      ) : (
        <section id="inspecao-capturas" aria-label="Capturas do lote" className="scroll-mt-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Capturas</h2>
          <div className="grid grid-cols-1 gap-4 lg:h-[min(760px,calc(100dvh-4rem))] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <div className="flex min-h-0 flex-col">
              <CaptureList images={images} statuses={statuses} selected={index} filter={filter} onFilter={setFilter} onSelect={go} />
            </div>
            <CaptureViewer
              image={images[index]}
              index={index}
              total={images.length}
              view={view}
              onView={setView}
              onPrev={() => go(index - 1)}
              onNext={() => go(index + 1)}
            />
            <div className="min-h-0 lg:col-span-2 xl:col-span-1">
              <CaptureFindings capture={capture} flags={flags[index]} view={view} onView={setView} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
