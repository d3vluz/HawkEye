import { ShieldCheck } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { DashboardPanel, PanelEmpty } from "./panel"
import { number, percent, plural } from "./format"

function trend(share: number | null, previous: number | null) {
  if (share === null || previous === null) return null
  const diff = share - previous
  if (Math.abs(diff) < 0.05) return { label: "estável", className: "text-muted-foreground" }
  return {
    label: `${diff > 0 ? "+" : "−"}${number(Math.abs(diff), 1)} p.p.`,
    className: diff > 0 ? "text-danger-emphasis" : "text-success-emphasis",
  }
}

export function DefectsByType({ data }: { data: DashboardMetrics }) {
  const found = data.defectsByType.filter((d) => d.captures > 0)
  const widest = Math.max(...found.map((d) => d.share ?? 0), 1)

  return (
    <DashboardPanel title="Defeitos por tipo" description="Parte das capturas do período com cada defeito">
      {found.length === 0 ? (
        <PanelEmpty icon={<ShieldCheck className="h-8 w-8 text-success-emphasis" />} title="Nenhum defeito detectado">
          {data.current.captures > 0
            ? `As ${number(data.current.captures)} capturas dos últimos ${data.periodDays} dias passaram sem defeito.`
            : `Ainda não há capturas nos últimos ${data.periodDays} dias.`}
        </PanelEmpty>
      ) : (
        <ul className="space-y-4">
          {found.map((defect) => {
            const change = trend(defect.share, defect.previousShare)
            return (
              <li key={defect.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{defect.label}</span>
                  <span className="font-semibold text-foreground tabular-nums">{percent(defect.share)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-danger/70" style={{ width: `${((defect.share ?? 0) / widest) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{plural(defect.captures, "captura", "capturas")}</span>
                  {change && <span className={cn("tabular-nums", change.className)}>{change.label}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardPanel>
  )
}
