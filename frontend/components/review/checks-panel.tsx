"use client"

import { CheckCircle2, CircleAlert, Undo2, XCircle } from "lucide-react"
import type { InspectionSettings } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { CHECKS, rejects, type DefectKey, type Flags, type Overrides, type ProcessedImage, type ViewKey } from "@/lib/review"

export function ChecksPanel({ image, auto, flags, overrides, settings, view, onSet, onReset, onView }: {
  image: ProcessedImage
  auto: Flags
  flags: Flags
  overrides: Overrides | undefined
  settings: InspectionSettings | null
  view: ViewKey
  onSet: (key: DefectKey, value: boolean) => void
  onReset: () => void
  onView: (v: ViewKey) => void
}) {
  const failing = CHECKS.filter((c) => flags[c.key] && rejects(c.key, settings))
  const corrected = Object.keys(overrides ?? {}).length > 0
  const rejected = failing.length > 0

  return (
    <section aria-label="Verificações da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className={cn("border-b border-border p-4", rejected ? "bg-danger/8" : "bg-success/8")}>
        <div className="flex items-center gap-2">
          {rejected ? <XCircle className="size-5 text-danger-emphasis" /> : <CheckCircle2 className="size-5 text-success-emphasis" />}
          <h2 className="text-base font-semibold text-foreground">
            {rejected ? "Captura reprovada" : "Captura aprovada"}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rejected
            ? `Motivo: ${failing.map((c) => c.label.toLowerCase()).join(", ")}.`
            : "Nenhum defeito que reprove a peça pelos critérios atuais."}
        </p>
        {corrected && (
          <button
            onClick={onReset}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-emphasis hover:underline"
          >
            <Undo2 className="size-3.5" /> Desfazer minhas correções
          </button>
        )}
      </div>

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Confira cada item na imagem. Se o sistema errou, marque o resultado certo.
      </p>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {CHECKS.map((check) => {
          const value = flags[check.key]
          const isCorrected = overrides?.[check.key] !== undefined
          const tolerated = value && !rejects(check.key, settings)
          const detail = isCorrected
            ? value ? "Marcado por você como defeito" : `Sistema apontou: ${check.found(image, settings).toLowerCase()}`
            : value ? check.found(image, settings) : check.clear

          return (
            <li key={check.key} className={cn("rounded-lg p-2", view === check.view && "bg-muted/60")}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5">
                  {value
                    ? <CircleAlert className={cn("size-4", tolerated ? "text-warning-emphasis" : "text-danger-emphasis")} />
                    : <CheckCircle2 className="size-4 text-success-emphasis" />}
                </span>
                <button
                  onClick={() => onView(check.view)}
                  className="min-w-0 flex-1 text-left"
                  title="Mostrar a camada correspondente"
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                    {check.label}
                    {isCorrected && <span className="rounded bg-primary/12 px-1.5 text-[11px] font-medium text-primary-emphasis">corrigido</span>}
                  </span>
                  <span className={cn("block text-xs", isCorrected && !value ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-muted-foreground")}>
                    {detail}
                  </span>
                  {tolerated && <span className="block text-xs text-warning-emphasis">Não reprova pelos critérios atuais</span>}
                </button>
                <div role="radiogroup" aria-label={`Resultado de ${check.label}`} className="flex shrink-0 rounded-md border border-border p-0.5">
                  {([false, true] as const).map((option) => (
                    <button
                      key={String(option)}
                      role="radio"
                      aria-checked={value === option}
                      onClick={() => onSet(check.key, option)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        value === option
                          ? option ? "bg-danger/15 text-danger-emphasis" : "bg-success/15 text-success-emphasis"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option ? "Defeito" : "OK"}
                      {auto[check.key] === option && value !== option && <span className="sr-only"> (indicado pelo sistema)</span>}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
