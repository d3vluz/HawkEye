// Últimos lotes registrados, com atalho para o detalhe de cada um.

import Link from "next/link"
import { ArrowRight, Package } from "lucide-react"
import { data, numero, percentual } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { MetricasDoDashboard } from "@/types"
import { Painel, PainelVazio } from "./painel"

const CABECALHO = "whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-muted-foreground"
const CELULA = "whitespace-nowrap px-5 py-3"

export function LotesRecentes({ metricas }: { metricas: MetricasDoDashboard }) {
  return (
    <Painel
      titulo="Lotes recentes"
      acao={
        <Link href="/admin/batches" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary-emphasis hover:underline">
          Ver todos <ArrowRight className="size-3.5" />
        </Link>
      }
      className="[&>div]:p-0"
    >
      {metricas.recentBatches.length === 0 ? (
        <PainelVazio icone={<Package className="size-8 text-muted-foreground" />} titulo="Nenhum lote registrado ainda" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={CABECALHO}>Lote</th>
                <th className={CABECALHO}>Linha</th>
                <th className={CABECALHO}>Coletado por</th>
                <th className={cn(CABECALHO, "text-right")}>Capturas</th>
                <th className={cn(CABECALHO, "text-right")}>Defeitos</th>
                <th className={cn(CABECALHO, "text-right")}>Aprovação</th>
                <th className={cn(CABECALHO, "text-right")}>Data</th>
              </tr>
            </thead>
            <tbody>
              {metricas.recentBatches.map((lote) => (
                <tr key={lote.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted">
                  <td className={CELULA}>
                    <Link href={`/admin/batches/${lote.id}`} className="font-medium text-foreground hover:underline">{lote.name}</Link>
                  </td>
                  <td className={cn(CELULA, "text-muted-foreground")}>{lote.unit?.name ?? "Sem linha"}</td>
                  <td className={cn(CELULA, "text-muted-foreground")}>
                    {lote.author ? lote.author.name ?? `Matrícula ${lote.author.matricula}` : "—"}
                  </td>
                  <td className={cn(CELULA, "text-right text-foreground tabular-nums")}>{numero(lote.total_captures)}</td>
                  <td className={cn(CELULA, "text-right text-foreground tabular-nums")}>{numero(lote.total_defects)}</td>
                  <td
                    className={cn(
                      CELULA,
                      "text-right font-semibold tabular-nums",
                      lote.quality_score < metricas.qualityTarget ? "text-danger-emphasis" : "text-success-emphasis"
                    )}
                  >
                    {percentual(lote.quality_score)}
                  </td>
                  <td className={cn(CELULA, "text-right text-muted-foreground tabular-nums")}>{data(lote.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}
