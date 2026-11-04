"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Package } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { KpiGrid } from "@/components/dashboard/kpi-grid"
import { QualityTrend } from "@/components/dashboard/quality-trend"
import { DefectsByType } from "@/components/dashboard/defects-by-type"
import { UnitsComparison } from "@/components/dashboard/units-comparison"
import { Operators } from "@/components/dashboard/operators"
import { RecentBatches } from "@/components/dashboard/recent-batches"
import { number, percent } from "@/components/dashboard/format"
import { getDashboardMetrics, getUnits, type DashboardMetrics, type Unit } from "@/lib/api-client"

const ALL_UNITS = "all"
const REFRESH_MS = 30_000

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [unitFilter, setUnitFilter] = useState(ALL_UNITS)

  useEffect(() => {
    getUnits().then(setUnits).catch(() => setUnits([]))
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setData(await getDashboardMetrics(unitFilter === ALL_UNITS ? undefined : unitFilter))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar métricas")
      }
    }
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => clearInterval(interval)
  }, [unitFilter])

  const selectedUnit = unitFilter === ALL_UNITS ? undefined : unitFilter

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
            <span>ADMIN</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">DASHBOARD</span>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `Últimos ${data.periodDays} dias comparados com os ${data.periodDays} anteriores. Desde o início: ${number(data.totals.batches)} lotes, ${number(data.totals.captures)} capturas e ${percent(data.totals.approvalRate)} de aprovação.`
              : "Qualidade das inspeções aprovadas."}
          </p>
        </div>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="h-9 w-full shrink-0 sm:w-48" aria-label="Filtrar por linha">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_UNITS}>Todas as linhas</SelectItem>
            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger-emphasis">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!data && !error && (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-signal" />
            <p className="font-medium text-muted-foreground">Carregando dashboard...</p>
          </div>
        </div>
      )}

      {data && data.totals.batches === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">
            {selectedUnit ? "Esta linha ainda não tem lotes aprovados" : "Nenhum lote aprovado ainda"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            As métricas aparecem quando um funcionário aprova o primeiro lote na inspeção.
          </p>
          {selectedUnit && (
            <button onClick={() => setUnitFilter(ALL_UNITS)} className="mt-4 text-sm font-medium text-primary-emphasis hover:underline">
              Ver todas as linhas
            </button>
          )}
        </div>
      )}

      {data && data.totals.batches > 0 && (
        <div className="space-y-6">
          <KpiGrid data={data} />
          <div className="grid gap-6 xl:grid-cols-3">
            <QualityTrend data={data} />
            <DefectsByType data={data} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <UnitsComparison data={data} selectedUnitId={selectedUnit} />
            <Operators data={data} />
          </div>
          <RecentBatches data={data} />
        </div>
      )}
    </div>
  )
}
