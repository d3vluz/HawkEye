import { Users } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { DashboardPanel, PanelEmpty } from "./panel"
import { number, percent } from "./format"

const TH = "whitespace-nowrap pb-2 pl-4 text-left text-xs font-medium text-muted-foreground first:pl-0"

export function Operators({ data }: { data: DashboardMetrics }) {
  return (
    <DashboardPanel title="Quem mais inspecionou" description={`Os 5 funcionários com mais capturas nos últimos ${data.periodDays} dias`}>
      {data.operators.length === 0 ? (
        <PanelEmpty icon={<Users className="h-8 w-8 text-muted-foreground" />} title="Nenhuma coleta no período" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Funcionário</th>
              <th className={cn(TH, "text-right")}>Lotes</th>
              <th className={cn(TH, "text-right")}>Capturas</th>
              <th className={cn(TH, "text-right")}>Aprovação</th>
            </tr>
          </thead>
          <tbody>
            {data.operators.map((op) => (
              <tr key={op.matricula} className="border-b border-border last:border-0">
                <td className="py-2.5">
                  <p className="font-medium text-foreground">{op.name ?? "Membro removido"}</p>
                  <p className="text-xs text-muted-foreground">Matrícula {op.matricula}</p>
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-foreground">{number(op.batches)}</td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-foreground">{number(op.captures)}</td>
                <td
                  className={cn(
                    "py-2.5 pl-4 text-right font-semibold tabular-nums",
                    op.approvalRate !== null && op.approvalRate < data.qualityTarget ? "text-danger-emphasis" : "text-success-emphasis"
                  )}
                >
                  {percent(op.approvalRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardPanel>
  )
}
