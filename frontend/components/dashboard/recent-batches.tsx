import Link from "next/link"
import { ArrowRight, Package } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { DashboardPanel, PanelEmpty } from "./panel"
import { number, percent } from "./format"

const TH = "whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-muted-foreground"
const TD = "whitespace-nowrap px-5 py-3"

export function RecentBatches({ data }: { data: DashboardMetrics }) {
  return (
    <DashboardPanel
      title="Lotes recentes"
      action={
        <Link href="/admin/batches" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary-emphasis hover:underline">
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
      className="[&>div]:p-0"
    >
      {data.recentBatches.length === 0 ? (
        <PanelEmpty icon={<Package className="h-8 w-8 text-muted-foreground" />} title="Nenhum lote aprovado ainda" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>Lote</th>
                <th className={TH}>Linha</th>
                <th className={TH}>Coletado por</th>
                <th className={cn(TH, "text-right")}>Capturas</th>
                <th className={cn(TH, "text-right")}>Defeitos</th>
                <th className={cn(TH, "text-right")}>Aprovação</th>
                <th className={cn(TH, "text-right")}>Data</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBatches.map((batch) => {
                const below = batch.approvalRate !== null && batch.approvalRate < data.qualityTarget
                return (
                  <tr key={batch.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted">
                    <td className={TD}>
                      <Link href={`/admin/batches/${batch.id}`} className="font-medium text-foreground hover:underline">{batch.name}</Link>
                    </td>
                    <td className={cn(TD, "text-muted-foreground")}>{batch.unit?.name ?? "Sem linha"}</td>
                    <td className={cn(TD, "text-muted-foreground")}>
                      {batch.author ? batch.author.name ?? `Matrícula ${batch.author.matricula}` : "—"}
                    </td>
                    <td className={cn(TD, "text-right tabular-nums text-foreground")}>{number(batch.captures)}</td>
                    <td className={cn(TD, "text-right tabular-nums text-foreground")}>{number(batch.defects)}</td>
                    <td className={cn(TD, "text-right font-semibold tabular-nums", below ? "text-danger-emphasis" : "text-success-emphasis")}>
                      {percent(batch.approvalRate)}
                    </td>
                    <td className={cn(TD, "text-right tabular-nums text-muted-foreground")}>
                      {new Date(batch.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}
