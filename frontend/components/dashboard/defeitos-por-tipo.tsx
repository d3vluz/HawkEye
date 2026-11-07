// Parte das capturas do período com cada tipo de defeito e a variação em relação ao período anterior.

import { ShieldCheck } from "lucide-react"
import { numero, percentual, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { MetricasDoDashboard } from "@/types"
import { Painel, PainelVazio } from "./painel"

function tendencia(parte: number | null, anterior: number | null) {
  if (parte === null || anterior === null) return null
  const diferenca = parte - anterior
  if (Math.abs(diferenca) < 0.05) return { rotulo: "estável", cor: "text-muted-foreground" }
  return {
    rotulo: `${diferenca > 0 ? "+" : "−"}${numero(Math.abs(diferenca), 1)} p.p.`,
    cor: diferenca > 0 ? "text-danger-emphasis" : "text-success-emphasis",
  }
}

export function DefeitosPorTipo({ metricas }: { metricas: MetricasDoDashboard }) {
  const encontrados = metricas.defectsByType.filter((d) => d.captures > 0)
  const maior = Math.max(...encontrados.map((d) => d.share ?? 0), 1)

  return (
    <Painel titulo="Defeitos por tipo" descricao="Parte das capturas do período com cada defeito">
      {encontrados.length === 0 ? (
        <PainelVazio icone={<ShieldCheck className="size-8 text-success-emphasis" />} titulo="Nenhum defeito detectado">
          {metricas.current.captures > 0
            ? `As ${numero(metricas.current.captures)} capturas dos últimos ${metricas.periodDays} dias passaram sem defeito.`
            : `Ainda não há capturas nos últimos ${metricas.periodDays} dias.`}
        </PainelVazio>
      ) : (
        <ul className="space-y-4">
          {encontrados.map((defeito) => {
            const mudanca = tendencia(defeito.share, defeito.previousShare)
            return (
              <li key={defeito.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{defeito.label}</span>
                  <span className="font-semibold text-foreground tabular-nums">{percentual(defeito.share)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-danger/70" style={{ width: `${((defeito.share ?? 0) / maior) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{plural(defeito.captures, "captura", "capturas")}</span>
                  {mudanca && <span className={cn("tabular-nums", mudanca.cor)}>{mudanca.rotulo}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Painel>
  )
}
