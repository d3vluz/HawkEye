import { Card } from "@/components/ui/card"

interface BatchMetricsProps {
  data: {
    recentBatches: Array<{
      name: string
      totalCaptures: number
      validCaptures: number
      qualityScore: number
      defectCount: number
    }>
  }
}

export default function BatchMetrics({ data }: BatchMetricsProps) {
  return (
    <Card className="p-6 mt-8">
      <h3 className="text-lg font-semibold text-foreground mb-4">Lotes Recentes</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Lote</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Total de Imagens</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Imagens Válidas</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Taxa de Sucesso</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Defeitos</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Score de Qualidade</th>
            </tr>
          </thead>
          <tbody>
            {data.recentBatches.map((batch, idx) => {
              const successRate =
                batch.totalCaptures > 0 ? ((batch.validCaptures / batch.totalCaptures) * 100).toFixed(1) : "0"

              const scoreColor =
                batch.qualityScore >= 90
                  ? "text-success-emphasis"
                  : batch.qualityScore >= 70
                    ? "text-warning-emphasis"
                    : "text-danger-emphasis"

              return (
                <tr key={idx} className="border-b border-border hover:bg-muted transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{batch.name}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{batch.totalCaptures}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{batch.validCaptures}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground font-medium tabular-nums">{successRate}%</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{batch.defectCount}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${scoreColor}`}>
                    {batch.qualityScore?.toFixed(1) || "N/A"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}