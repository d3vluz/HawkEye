// Aprovação de cada linha de produção no período, com a meta marcada na barra.

import { Factory } from "lucide-react"
import { percentual, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { MetricasDoDashboard } from "@/types"
import { Painel, PainelVazio } from "./painel"

export function LinhasDeProducao({ metricas, linhaSelecionada }: { metricas: MetricasDoDashboard; linhaSelecionada?: string }) {
  const ativas = metricas.units.filter((l) => l.captures > 0)
  const paradas = metricas.units.filter((l) => l.captures === 0 && l.id !== null)
  const meta = metricas.qualityTarget

  return (
    <Painel titulo="Linhas de produção" descricao={`Aprovação de cada linha nos últimos ${metricas.periodDays} dias`}>
      {ativas.length === 0 ? (
        <PainelVazio icone={<Factory className="size-8 text-muted-foreground" />} titulo="Nenhuma linha com lotes no período" />
      ) : (
        <ul className="space-y-4">
          {ativas.map((linha) => {
            const abaixo = linha.approvalRate !== null && linha.approvalRate < meta
            return (
              <li key={linha.id ?? "sem-linha"} className={cn(linhaSelecionada && linha.id !== linhaSelecionada && "opacity-50")}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{linha.name}</span>
                  <span className={cn("font-semibold tabular-nums", abaixo ? "text-danger-emphasis" : "text-success-emphasis")}>
                    {percentual(linha.approvalRate)}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", abaixo ? "bg-danger/70" : "bg-success/70")} style={{ width: `${linha.approvalRate ?? 0}%` }} />
                  <span className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60" style={{ left: `${meta}%` }} aria-hidden />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plural(linha.captures, "captura", "capturas")} · {plural(linha.batches, "lote", "lotes")}
                  {linha.belowTarget > 0 && ` · ${plural(linha.belowTarget, "abaixo da meta", "abaixo da meta")}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-auto pt-4 text-xs text-muted-foreground">
        O traço marca a meta de {meta}%.
        {paradas.length > 0 && ` Sem lotes no período: ${paradas.map((l) => l.name).join(", ")}.`}
      </p>
    </Painel>
  )
}
