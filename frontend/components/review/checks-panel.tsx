"use client"

import { CheckCircle2, CircleAlert, Undo2, XCircle } from "lucide-react"
import type { InspectionSettings } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { CHECKS, rejects, type DefectKey, type Flags, type Overrides, type ProcessedImage, type ViewKey } from "@/lib/review"

export function ChecksPanel({ image, flags, overrides, settings, view, onSet, onReset, onView }: {
  image: ProcessedImage
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
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          {rejected ? <XCircle className="size-5 text-danger-emphasis" /> : <CheckCircle2 className="size-5 text-success-emphasis" />}
          <h2 className="text-base font-semibold text-foreground">{rejected ? "Captura reprovada" : "Captura aprovada"}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rejected
            ? `Motivo: ${failing.map((c) => c.label.toLowerCase()).join(", ")}.`
            : "Nenhum defeito que reprove a peça pelos critérios atuais."}
        </p>
        {corrected && (
          <button onClick={onReset} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-emphasis hover:underline">
            <Undo2 className="size-3.5" /> Desfazer minhas correções
          </button>
        )}
      </div>

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Confira cada item na imagem. Se o sistema errou, marque o resultado certo.
      </p>

      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-2 pb-2">
        {CHECKS.map((check) => {
          const value = flags[check.key]
          const isCorrected = overrides?.[check.key] !== undefined
          const tolerated = value && !rejects(check.key, settings)
          const detail = isCorrected
            ? value ? "Você marcou como defeito" : `O sistema apontou ${check.found(image, settings).toLowerCase()}; você marcou como OK`
            : value ? check.found(image, settings) : check.clear

          return (
            <li key={check.key} className="py-1">
              <div className={cn("flex items-start gap-2.5 rounded-lg px-2 py-2", view === check.view && "bg-muted/50")}>
                <span className="mt-0.5">
                  {value
                    ? <CircleAlert className={cn("size-4", tolerated ? "text-warning-emphasis" : "text-danger-emphasis")} />
                    : <CheckCircle2 className="size-4 text-success-emphasis" />}
                </span>
                <button onClick={() => onView(check.view)} className="min-w-0 flex-1 text-left" title="Mostrar a camada correspondente">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                    {check.label}
                    {isCorrected && <span className="text-[11px] font-medium text-primary-emphasis">· corrigido</span>}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                  {tolerated && <span className="block text-xs text-warning-emphasis">Não reprova pelos critérios atuais</span>}
                </button>
                <div role="radiogroup" aria-label={`Resultado de ${check.label}`} className="flex shrink-0 rounded-md bg-muted p-0.5">
                  {([false, true] as const).map((option) => (
                    <button
                      key={String(option)}
                      role="radio"
                      aria-checked={value === option}
                      onClick={() => onSet(check.key, option)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        value === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option ? "Defeito" : "OK"}
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
