import { Factory } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { DashboardPanel, PanelEmpty } from "./panel"
import { percent, plural } from "./format"

export function UnitsComparison({ data, selectedUnitId }: { data: DashboardMetrics; selectedUnitId?: string }) {
  const active = data.units.filter((u) => u.captures > 0)
  const idle = data.units.filter((u) => u.captures === 0 && u.id !== null)

  return (
    <DashboardPanel title="Linhas de produção" description={`Aprovação de cada linha nos últimos ${data.periodDays} dias`}>
      {active.length === 0 ? (
        <PanelEmpty icon={<Factory className="h-8 w-8 text-muted-foreground" />} title="Nenhuma linha com lotes no período" />
      ) : (
        <ul className="space-y-4">
          {active.map((unit) => {
            const below = unit.approvalRate !== null && unit.approvalRate < data.qualityTarget
            return (
              <li key={unit.id ?? "none"} className={cn(selectedUnitId && unit.id !== selectedUnitId && "opacity-50")}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{unit.name}</span>
                  <span className={cn("font-semibold tabular-nums", below ? "text-danger-emphasis" : "text-success-emphasis")}>
                    {percent(unit.approvalRate)}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", below ? "bg-danger/70" : "bg-success/70")}
                    style={{ width: `${unit.approvalRate ?? 0}%` }}
                  />
                  <span
                    className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60"
                    style={{ left: `${data.qualityTarget}%` }}
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plural(unit.captures, "captura", "capturas")} · {plural(unit.batches, "lote", "lotes")}
                  {unit.belowTarget > 0 && ` · ${plural(unit.belowTarget, "abaixo da meta", "abaixo da meta")}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-auto pt-4 text-xs text-muted-foreground">
        O traço marca a meta de {data.qualityTarget}%.
        {idle.length > 0 && ` Sem lotes no período: ${idle.map((u) => u.name).join(", ")}.`}
      </p>
    </DashboardPanel>
  )
}
