"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { CaptureList, StatusDot, type CaptureStatus, type ListFilter } from "@/components/review/capture-list"
import { LotOverview } from "@/components/review/lot-overview"
import { cn } from "@/lib/utils"
import { CaptureViewer } from "@/components/review/capture-viewer"
import { ChecksPanel } from "@/components/review/checks-panel"
import { RegisterDialog, type RegisterValues } from "@/components/review/register-dialog"
import { apiFetch, getInspectionSettings, getMyUnits, type InspectionSettings, type Unit } from "@/lib/api-client"
import {
  CHECKS, autoFlags, corrections, defectCount, effectiveFlags, failingChecks, setOverride,
  type DefectKey, type Overrides, type ProcessedImage, type ViewKey,
} from "@/lib/review"

const IMAGES_KEY = "processedImages"
const OVERRIDES_KEY = "reviewOverrides"
const VIEW_BY_DEFECT = Object.fromEntries(CHECKS.map((c) => [c.key, c.view])) as Record<DefectKey, ViewKey>

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function clearSession() {
  sessionStorage.removeItem(IMAGES_KEY)
  sessionStorage.removeItem(OVERRIDES_KEY)
}

export default function ReviewPage() {
  const router = useRouter()
  const [images, setImages] = useState<ProcessedImage[] | null>(null)
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<ViewKey>("original")
  const [filter, setFilter] = useState<ListFilter>("all")
  const [mode, setMode] = useState<"overview" | "review">("overview")
  const [overrides, setOverrides] = useState<Record<string, Overrides>>({})
  const [settings, setSettings] = useState<InspectionSettings | null>(null)
  const [units, setUnits] = useState<Unit[] | null>(null)
  const [dialog, setDialog] = useState<"register" | "reject" | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = readSession<ProcessedImage[]>(IMAGES_KEY)
    if (!saved?.length) {
      router.replace("/inspecao")
      return
    }
    setImages(saved)
    setOverrides(readSession<Record<string, Overrides>>(OVERRIDES_KEY) ?? {})
    getInspectionSettings().then(setSettings).catch(() => setSettings(null))
    getMyUnits().then(setUnits).catch(() => setUnits([]))
  }, [router])

  // As correções sobrevivem a um recarregamento da página até o lote ser registrado ou reprovado.
  useEffect(() => {
    if (images) sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
  }, [overrides, images])

  const reviews = useMemo(() => (images ?? []).map((img) => {
    const auto = autoFlags(img, settings)
    const own = overrides[img.sha256]
    const flags = effectiveFlags(auto, own)
    return { auto, flags, own, failing: failingChecks(flags, settings) }
  }), [images, overrides, settings])

  const statuses: CaptureStatus[] = reviews.map((r) => ({ failing: r.failing, corrected: Object.keys(r.own ?? {}).length > 0 }))
  const summary = {
    total: reviews.length,
    approved: reviews.filter((r) => r.failing.length === 0).length,
    rejected: reviews.filter((r) => r.failing.length > 0).length,
    corrected: statuses.filter((s) => s.corrected).length,
  }

  const go = useCallback((next: number) => {
    if (!images) return
    setIndex(Math.max(0, Math.min(images.length - 1, next)))
  }, [images])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (mode !== "review" || dialog || target.closest("input, textarea, select, [role=listbox], [contenteditable]")) return
      if (event.key === "ArrowRight") go(index + 1)
      if (event.key === "ArrowLeft") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, index, dialog, mode])

  if (!images) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const image = images[index]
  const review = reviews[index]

  const setFlag = (key: DefectKey, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [image.sha256]: setOverride(prev[image.sha256], review.auto, key, value) }))
  }
  const resetFlags = () => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[image.sha256]
      return next
    })
  }

  const register = async ({ unitId, name, description }: RegisterValues) => {
    setPending(true)
    setError(null)
    try {
      const captures = images.map((img, i) => {
        const { auto, flags, own } = reviews[i]
        return {
          filename: img.filename,
          sha256: img.sha256,
          areas_detected: img.areas_count,
          grid_rows: img.grid_rows,
          grid_cols: img.grid_cols,
          defects_count: defectCount(img, flags, auto),
          has_missing_pins: flags.missing,
          has_extra_pins: flags.extra,
          has_damaged_pins: flags.damaged,
          has_wrong_color_pins: flags.wrongColor,
          has_shaft_defects: flags.shaft,
          structure_override: own?.structure,
          corrections: corrections(auto, own),
        }
      })
      const res = await apiFetch("/api/batches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit_id: unitId, description, batch_timestamp: images[0]?.timestamp ?? "", captures }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível registrar o lote.")
      }
      clearSession()
      router.push("/coletas")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o lote.")
      setPending(false)
    }
  }

  const reject = async () => {
    setPending(true)
    setError(null)
    try {
      const res = await apiFetch("/api/batches/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: images[0]?.timestamp }),
      })
      if (!res.ok) throw new Error()
      clearSession()
      router.push("/inspecao")
    } catch {
      setError("Não foi possível reprovar o lote. Tente novamente.")
      setPending(false)
    }
  }

  const openCapture = (i: number) => {
    setIndex(i)
    setMode("review")
  }
  const openDefect = (key: DefectKey) => {
    const first = reviews.findIndex((r) => r.flags[key])
    if (first < 0) return
    setFilter("all")
    setView(VIEW_BY_DEFECT[key])
    openCapture(first)
  }

  return (
    <div className={cn("flex min-h-dvh flex-col gap-4 p-4 sm:p-6", mode === "review" && "xl:h-dvh")}>
      <PageHeader
        crumbs={[{ label: "Inspeção" }, { label: "Novo lote" }]}
        title="Revisão do lote"
        description="Confira as capturas, corrija o que o sistema errou e registre ou reprove o lote."
        actions={
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div><dt className="text-muted-foreground">Capturas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{summary.total}</dd></div>
          <div><dt className="flex items-center gap-1.5 text-muted-foreground"><StatusDot rejected={false} />Aprovadas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{summary.approved}</dd></div>
          <div><dt className="flex items-center gap-1.5 text-muted-foreground"><StatusDot rejected />Reprovadas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{summary.rejected}</dd></div>
          <div><dt className="text-muted-foreground">Corrigidas</dt><dd className="text-lg font-semibold tabular-nums text-foreground">{summary.corrected}</dd></div>
        </dl>
        }
      />

      <div role="tablist" aria-label="Modo de revisão" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {([["overview", "Visão geral"], ["review", "Revisar capturas"]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "overview" ? (
        <LotOverview
          images={images}
          statuses={statuses}
          flags={reviews.map((r) => r.flags)}
          onOpen={openCapture}
          onOpenDefect={openDefect}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col lg:row-span-2 lg:max-h-[calc(100dvh-14rem)] xl:row-span-1 xl:max-h-none">
            <CaptureList
              images={images}
              statuses={statuses}
              selected={index}
              filter={filter}
              onFilter={setFilter}
              onSelect={go}
            />
          </div>
          <CaptureViewer
            image={image}
            index={index}
            total={images.length}
            view={view}
            onView={setView}
            onPrev={() => go(index - 1)}
            onNext={() => go(index + 1)}
          />
          <ChecksPanel
            image={image}
            flags={review.flags}
            overrides={review.own}
            settings={settings}
            view={view}
            onSet={setFlag}
            onReset={resetFlags}
            onView={setView}
          />
        </div>
      )}

      <footer className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-card">
        <p className="text-sm text-muted-foreground">
          {summary.rejected === 0
            ? "Todas as capturas foram aprovadas."
            : `${summary.rejected} de ${summary.total} capturas serão registradas como reprovadas.`}
          {error && !dialog && <span role="alert" className="ml-2 text-danger-emphasis">{error}</span>}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" className="flex-1 text-danger-emphasis hover:text-danger-emphasis sm:flex-none" onClick={() => { setError(null); setDialog("reject") }}>
            Reprovar lote
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { setError(null); setDialog("register") }}>Registrar lote</Button>
        </div>
      </footer>

      {dialog === "register" && (
        <RegisterDialog
          open
          units={units}
          summary={summary}
          pending={pending}
          error={error}
          onSubmit={register}
          onCancel={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog === "reject"}
        title="Reprovar este lote?"
        description={`As ${summary.total} imagens serão apagadas e nada será registrado. Use quando o lote inteiro precisar ser refeito.`}
        confirmLabel="Reprovar lote"
        pendingLabel="Reprovando..."
        pending={pending}
        error={dialog === "reject" ? error : null}
        onConfirm={reject}
        onCancel={() => setDialog(null)}
      />
    </div>
  )
}
