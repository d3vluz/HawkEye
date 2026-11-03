"use client"

import { useEffect, useState } from "react"
import { RefreshCw, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { formatBytes, PanelState, SettingsPanel } from "@/components/settings/panel"
import { cleanupAbandonedReviews, getStorageUsage, type StorageUsage } from "@/lib/api-client"

function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`
}

export function StorageSection() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      setUsage(await getStorageUsage())
      setLoadError(null)
    } catch (error) {
      setLoadError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const confirmCleanup = async () => {
    setCleaning(true)
    try {
      const removed = await cleanupAbandonedReviews()
      setConfirming(false)
      setResult(`${plural(removed.sessions, "revisão removida", "revisões removidas")}, ${formatBytes(removed.bytes)} liberados.`)
      await refresh()
    } catch (error) {
      setCleanError((error as Error).message)
    } finally {
      setCleaning(false)
    }
  }

  const buckets = usage && [
    { label: "Aprovadas", hint: "Imagens dos lotes salvos", ...usage.permanent },
    { label: "Em revisão", hint: "Inspeções ainda não aprovadas nem rejeitadas", ...usage.review },
  ]

  return (
    <SettingsPanel
      title="Armazenamento"
      description="Espaço ocupado pelas imagens no MinIO. Quando uma inspeção é abandonada sem aprovar nem rejeitar, as imagens ficam na revisão até serem limpas aqui."
      action={
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
        </Button>
      }
    >
      {loadError && <PanelState tone="danger">{loadError}</PanelState>}
      {!usage && !loadError && <PanelState>Lendo o armazenamento...</PanelState>}

      {usage && buckets && (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="rounded-lg border border-border p-4">
                <dt className="text-sm font-medium text-muted-foreground">{bucket.label}</dt>
                <dd className="mt-1 text-2xl font-bold text-foreground tabular-nums">{formatBytes(bucket.bytes)}</dd>
                <dd className="text-xs text-muted-foreground">{plural(bucket.objects, "arquivo", "arquivos")} · {bucket.hint}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Revisões abandonadas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {usage.abandoned.sessions === 0
                  ? `Nenhuma inspeção parada há mais de ${usage.abandonedAfterHours} horas.`
                  : `${plural(usage.abandoned.sessions, "inspeção parada", "inspeções paradas")} há mais de ${usage.abandonedAfterHours} horas: ${plural(usage.abandoned.objects, "arquivo", "arquivos")}, ${formatBytes(usage.abandoned.bytes)}.`}
              </p>
              {result && <p className="mt-1 text-sm text-success-emphasis" aria-live="polite">{result}</p>}
            </div>
            <Button
              variant="outline"
              className="shrink-0 text-danger-emphasis hover:bg-danger/10 hover:text-danger-emphasis"
              disabled={usage.abandoned.sessions === 0}
              onClick={() => { setCleanError(null); setResult(null); setConfirming(true) }}
            >
              <Trash2 className="h-4 w-4" /> Limpar abandonadas
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Limpar as revisões abandonadas?"
        description={`Apaga as imagens de inspeções sem atividade há mais de ${usage?.abandonedAfterHours ?? 24} horas. Inspeções recentes e lotes aprovados não são afetados. Esta ação não pode ser desfeita.`}
        confirmLabel="Limpar revisões"
        pendingLabel="Limpando..."
        pending={cleaning}
        error={cleanError}
        onConfirm={confirmCleanup}
        onCancel={() => setConfirming(false)}
      />
    </SettingsPanel>
  )
}
