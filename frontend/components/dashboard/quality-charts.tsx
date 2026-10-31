"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card } from "@/components/ui/card"

interface QualityChartsProps {
  data: {
    defectTrends: Array<{ name: string; count: number; date: string }>
    errorDistribution: Array<{ name: string; value: number }>
    validityDistribution: Array<{ name: string; value: number; color: string }> 
  }
}

export default function QualityCharts({ data }: QualityChartsProps) {

  const validEntry = data.validityDistribution[0] || {
    value: 0,
    name: 'Válidas',
    color: 'var(--color-success)'
  };

  const incorrectEntry = data.validityDistribution[1] || {
    value: 0,
    name: 'Com Defeito',
    color: 'var(--color-danger)'
  };

  const total = validEntry.value + incorrectEntry.value;
  const validPercentage = total > 0 ? Math.round((validEntry.value / total) * 100) : 0;
  const incorrectPercentage = total > 0 ? Math.round((incorrectEntry.value / total) * 100) : 0;
  const CHART_DRAWING_AREA = 320;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6 h-[500px]">
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição de Erros</h3>
          <ResponsiveContainer width="100%" height={CHART_DRAWING_AREA}>
            <BarChart
              data={data.errorDistribution}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="var(--muted-foreground)"
                width={100}
              />

              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }}
              />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 h-[500px]">
          <h3 className="text-lg font-semibold text-foreground mb-4">Imagens Válidas</h3>
          <div className="relative" style={{ height: CHART_DRAWING_AREA }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.validityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5} 
                  fill="var(--chart-1)"
                  dataKey="value"
                  labelLine={false}
                >
                  {data.validityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            >
              <p className="text-4xl font-bold text-foreground tabular-nums">
                {validPercentage}%
              </p>
              <p className="text-sm text-muted-foreground">
                Válidos
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-around">
            <div className="text-center">
              <div className="flex items-center justify-center text-sm font-semibold text-foreground">
                <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: validEntry.color }}></span>
                Válidas
              </div>
              <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                {validPercentage}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-sm font-semibold text-foreground">
                <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: incorrectEntry.color }}></span>
                Inválidas
              </div>
              <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                {incorrectPercentage}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}