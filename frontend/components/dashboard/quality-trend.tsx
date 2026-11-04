"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { LineChart as LineChartIcon } from "lucide-react"
import type { DashboardMetrics } from "@/lib/api-client"
import { DashboardPanel, PanelEmpty } from "./panel"
import { number, percent, shortDate } from "./format"

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: 12,
}

export function QualityTrend({ data }: { data: DashboardMetrics }) {
  const hasData = data.series.some((d) => d.captures > 0)

  return (
    <DashboardPanel
      title="Qualidade por dia"
      className="xl:col-span-2"
      description={`Capturas aprovadas e taxa de aprovação nos últimos ${data.periodDays} dias`}
      action={
        <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal/40" aria-hidden /> Capturas</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-success" aria-hidden /> Aprovação</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-muted-foreground" aria-hidden /> Meta</span>
        </div>
      }
    >
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="captures" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--muted)" }}
                labelFormatter={(label) => shortDate(String(label))}
                formatter={(value, name) =>
                  name === "approvalRate"
                    ? [percent(value as number | null), "Aprovação"]
                    : [number(value as number), "Capturas"]
                }
              />
              <ReferenceLine yAxisId="rate" y={data.qualityTarget} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Bar yAxisId="captures" dataKey="captures" fill="color-mix(in oklch, var(--signal) 40%, transparent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line yAxisId="rate" dataKey="approvalRate" stroke="var(--success)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--success)", strokeWidth: 0 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <PanelEmpty icon={<LineChartIcon className="h-8 w-8 text-muted-foreground" />} title="Sem lotes no período">
          O gráfico aparece quando houver lotes aprovados nos últimos {data.periodDays} dias.
        </PanelEmpty>
      )}
    </DashboardPanel>
  )
}
