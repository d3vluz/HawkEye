"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelState, SettingsPanel } from "@/components/settings/panel"
import { getInspectionSettings, updateInspectionSettings, type InspectionSettings } from "@/lib/api-client"

type RejectKey = Extract<keyof InspectionSettings, `reject${string}`>

const DEFECTS: Array<{ key: RejectKey; label: string; hint: string }> = [
  { key: "rejectMissingPins", label: "Pino ausente", hint: "Compartimento vazio." },
  { key: "rejectExtraPins", label: "Pino extra", hint: "Mais de um pino no mesmo compartimento." },
  { key: "rejectDamagedPins", label: "Pino danificado", hint: "Pino menor que o esperado." },
  { key: "rejectWrongColorPins", label: "Cor incorreta", hint: "Pino fora do amarelo padrão." },
  { key: "rejectShaftDefects", label: "Defeito na haste", hint: "Haste torta ou fora do comprimento." },
  { key: "rejectStructureDamage", label: "Dano estrutural", hint: "Grade detectada diferente da esperada." },
]

function sameSettings(a: InspectionSettings, b: InspectionSettings) {
  return (Object.keys(a) as Array<keyof InspectionSettings>).every((key) => a[key] === b[key])
}

export function InspectionSection() {
  const [saved, setSaved] = useState<InspectionSettings | null>(null)
  const [draft, setDraft] = useState<InspectionSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    getInspectionSettings()
      .then((settings) => { setSaved(settings); setDraft(settings) })
      .catch((error) => setLoadError((error as Error).message))
  }, [])

  if (loadError) return <SettingsPanel title="Critérios de inspeção" description=""><PanelState tone="danger">{loadError}</PanelState></SettingsPanel>
  if (!saved || !draft) return <SettingsPanel title="Critérios de inspeção" description=""><PanelState>Carregando critérios...</PanelState></SettingsPanel>

  const checksGrid = draft.expectedRows !== null && draft.expectedCols !== null
  const dirty = !sameSettings(saved, draft)

  const update = (patch: Partial<InspectionSettings>) => {
    setJustSaved(false)
    setDraft({ ...draft, ...patch })
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const next = await updateInspectionSettings(draft)
      setSaved(next)
      setDraft(next)
      setJustSaved(true)
    } catch (error) {
      setSaveError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const numberValue = (value: string) => (value === "" ? NaN : Number(value))
  const invalidGrid = checksGrid && [draft.expectedRows, draft.expectedCols].some((n) => !Number.isInteger(n) || n! < 1 || n! > 50)
  const invalidScore = !Number.isInteger(draft.minQualityScore) || draft.minQualityScore < 0 || draft.minQualityScore > 100

  return (
    <form onSubmit={handleSave}>
      <SettingsPanel
        title="Critérios de inspeção"
        description="O padrão de qualidade que decide se uma captura é válida. A API aplica estes critérios quando o lote é aprovado. Os lotes já salvos mantêm o resultado que tinham."
        footer={
          <>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {saveError
                ? <span className="text-danger-emphasis">{saveError}</span>
                : justSaved
                  ? "Critérios salvos. Valem para os próximos lotes."
                  : saved.updatedAt && saved.updatedByMatricula
                    ? `Última alteração pela matrícula ${saved.updatedByMatricula} em ${new Date(saved.updatedAt).toLocaleString("pt-BR")}.`
                    : "Usando os critérios padrão."}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(saved)}>Descartar</Button>
              <Button type="submit" disabled={!dirty || saving || invalidGrid || invalidScore}>{saving ? "Salvando..." : "Salvar critérios"}</Button>
            </div>
          </>
        }
      >
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Grade esperada</legend>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checksGrid}
                  onChange={(e) => update(e.target.checked ? { expectedRows: 4, expectedCols: 4 } : { expectedRows: null, expectedCols: null })}
                />
                Conferir a grade da peça
              </label>
              {checksGrid && (
                <div className="flex items-end gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="expected-rows" className="text-xs font-medium text-muted-foreground">Linhas</label>
                    <Input
                      id="expected-rows" type="number" inputMode="numeric" min={1} max={50} className="w-24 tabular-nums"
                      aria-invalid={invalidGrid || undefined}
                      value={Number.isNaN(draft.expectedRows) ? "" : draft.expectedRows ?? ""}
                      onChange={(e) => update({ expectedRows: numberValue(e.target.value) })}
                    />
                  </div>
                  <span className="pb-2 text-muted-foreground" aria-hidden>×</span>
                  <div className="space-y-1.5">
                    <label htmlFor="expected-cols" className="text-xs font-medium text-muted-foreground">Colunas</label>
                    <Input
                      id="expected-cols" type="number" inputMode="numeric" min={1} max={50} className="w-24 tabular-nums"
                      aria-invalid={invalidGrid || undefined}
                      value={Number.isNaN(draft.expectedCols) ? "" : draft.expectedCols ?? ""}
                      onChange={(e) => update({ expectedCols: numberValue(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-pretty text-muted-foreground">
                {checksGrid
                  ? "Se a grade detectada tiver outro tamanho, a captura recebe dano estrutural. Use entre 1 e 50."
                  : "Sem conferência, o tamanho da grade não reprova nenhuma captura."}
              </p>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="min-quality" className="text-sm font-semibold text-foreground">Meta de qualidade do lote</label>
              <div className="flex items-center gap-2">
                <Input
                  id="min-quality" type="number" inputMode="numeric" min={0} max={100} className="w-24 tabular-nums"
                  aria-invalid={invalidScore || undefined}
                  aria-describedby="min-quality-hint"
                  value={Number.isNaN(draft.minQualityScore) ? "" : draft.minQualityScore}
                  onChange={(e) => update({ minQualityScore: numberValue(e.target.value) })}
                />
                <span className="text-sm text-muted-foreground">% de capturas válidas</span>
              </div>
              <p id="min-quality-hint" className="text-xs text-pretty text-muted-foreground">Lotes abaixo da meta aparecem destacados na lista de lotes. Use de 0 a 100.</p>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Defeitos que reprovam a captura</legend>
            <p className="mt-1 text-xs text-muted-foreground">Desmarcados, continuam contados nas métricas, mas não invalidam a captura.</p>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {DEFECTS.map(({ key, label, hint }) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={draft[key]}
                      onChange={(e) => update({ [key]: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      </SettingsPanel>
    </form>
  )
}
