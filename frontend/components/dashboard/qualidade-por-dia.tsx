"use client"

// Gráfico diário do período: barras de capturas, linha de aprovação e a meta tracejada.

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { LineChart } from "lucide-react"
import { diaEMes, numero, percentual } from "@/lib/formato"
import type { MetricasDoDashboard } from "@/types"
import { Painel, PainelVazio } from "./painel"

const ESTILO_DA_DICA = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: 12,
}

export function QualidadePorDia({ metricas }: { metricas: MetricasDoDashboard }) {
  const temDados = metricas.series.some((d) => d.captures > 0)

  return (
    <Painel
      titulo="Qualidade por dia"
      className="xl:col-span-2"
      descricao={`Capturas registradas e taxa de aprovação nos últimos ${metricas.periodDays} dias`}
      acao={
        <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-signal/40" aria-hidden /> Capturas</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-success" aria-hidden /> Aprovação</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-muted-foreground" aria-hidden /> Meta</span>
        </div>
      }
    >
      {temDados ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={metricas.series} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={diaEMes} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="capturas" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="taxa" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={ESTILO_DA_DICA}
                cursor={{ fill: "var(--muted)" }}
                labelFormatter={(rotulo) => diaEMes(String(rotulo))}
                formatter={(valor, nome) =>
                  nome === "approvalRate" ? [percentual(valor as number | null), "Aprovação"] : [numero(valor as number), "Capturas"]
                }
              />
              <ReferenceLine yAxisId="taxa" y={metricas.qualityTarget} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Bar yAxisId="capturas" dataKey="captures" fill="color-mix(in oklch, var(--signal) 40%, transparent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line yAxisId="taxa" dataKey="approvalRate" stroke="var(--success)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--success)", strokeWidth: 0 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <PainelVazio icone={<LineChart className="size-8 text-muted-foreground" />} titulo="Sem lotes no período">
          O gráfico aparece quando houver lotes registrados nos últimos {metricas.periodDays} dias.
        </PainelVazio>
      )}
    </Painel>
  )
}
