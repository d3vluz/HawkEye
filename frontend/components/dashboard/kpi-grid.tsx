import { AlertTriangle, CheckCircle2, ScanSearch, Target } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { KpiCard, Sparkline, type Delta } from "./kpi-card"
import { number, percent, plural } from "./format"

function relativeDelta(current: number | null, previous: number | null, higherIsBetter: boolean): Delta | null {
  if (current === null || previous === null || previous === 0 || current === previous) return null
  const change = ((current - previous) / previous) * 100
  return { label: `${number(Math.abs(change), 1)}%`, direction: change > 0 ? "up" : "down", good: change > 0 === higherIsBetter }
}

// Taxas comparam em pontos percentuais: de 80% para 88% é +8 p.p., não +10%.
function pointsDelta(current: number | null, previous: number | null): Delta | null {
  if (current === null || previous === null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.05) return null
  return { label: `${number(Math.abs(diff), 1)} p.p.`, direction: diff > 0 ? "up" : "down", good: diff > 0 }
}

export function KpiGrid({ data }: { data: DashboardMetrics }) {
  const { current, previous, series, periodDays, qualityTarget } = data
  const days = `${periodDays} dias`
  const belowShare = current.batches > 0 ? (current.belowTarget / current.batches) * 100 : 0

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={ScanSearch}
        tone="signal"
        title="Capturas inspecionadas"
        help={`Imagens de lotes aprovados nos últimos ${days}, comparadas com os ${days} anteriores.`}
        value={number(current.captures)}
        delta={relativeDelta(current.captures, previous.captures, true)}
        caption={`${plural(current.batches, "lote", "lotes")} nos últimos ${days}`}
        chart={<Sparkline values={series.map((d) => d.captures)} tone="signal" />}
        footer={<>{periodDays} dias anteriores: <strong className="font-semibold text-foreground">{number(previous.captures)}</strong></>}
      />
      <KpiCard
        icon={CheckCircle2}
        tone="success"
        title="Taxa de aprovação"
        help="Parte das capturas sem nenhum defeito que reprova, segundo os critérios de inspeção."
        value={percent(current.approvalRate)}
        delta={pointsDelta(current.approvalRate, previous.approvalRate)}
        caption={`Meta: ${qualityTarget}% de capturas válidas`}
        chart={<Sparkline values={series.map((d) => d.approvalRate)} tone="success" />}
        footer={<>{periodDays} dias anteriores: <strong className="font-semibold text-foreground">{percent(previous.approvalRate)}</strong></>}
      />
      <KpiCard
        icon={AlertTriangle}
        tone="warning"
        title="Defeitos por captura"
        help="Média de defeitos encontrados em cada imagem. Quanto menor, melhor."
        value={current.defectsPerCapture === null ? "—" : number(current.defectsPerCapture, 2)}
        delta={relativeDelta(current.defectsPerCapture, previous.defectsPerCapture, false)}
        caption="Média por imagem inspecionada"
        chart={<Sparkline values={series.map((d) => d.defectsPerCapture)} tone="warning" />}
        footer={<>{periodDays} dias anteriores: <strong className="font-semibold text-foreground">{previous.defectsPerCapture === null ? "—" : number(previous.defectsPerCapture, 2)}</strong></>}
      />
      <KpiCard
        icon={Target}
        tone="danger"
        title="Lotes abaixo da meta"
        help={`Lotes com menos de ${qualityTarget}% de capturas válidas. A meta é definida em Configurações.`}
        value={number(current.belowTarget)}
        delta={relativeDelta(current.belowTarget, previous.belowTarget, false)}
        caption={current.batches > 0 ? `${percent(belowShare, 0)} dos ${plural(current.batches, "lote", "lotes")} do período` : "Nenhum lote no período"}
        chart={
          <div className="flex h-12 items-end">
            <div className="h-2 w-full overflow-hidden rounded-full bg-success/25" role="img" aria-label={`${percent(belowShare, 0)} dos lotes abaixo da meta`}>
              <div className="h-full rounded-full bg-danger/70" style={{ width: `${belowShare}%` }} />
            </div>
          </div>
        }
        footer={<>{periodDays} dias anteriores: <strong className="font-semibold text-foreground">{number(previous.belowTarget)}</strong></>}
      />
    </div>
  )
}
