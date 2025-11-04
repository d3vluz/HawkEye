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
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Lotes Recentes - Análise Detalhada</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Lote</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Total de Imagens</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Imagens Válidas</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Taxa de Sucesso</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Defeitos</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Score de Qualidade</th>
            </tr>
          </thead>
          <tbody>
            {data.recentBatches.map((batch, idx) => {
              const successRate =
                batch.totalCaptures > 0 ? ((batch.validCaptures / batch.totalCaptures) * 100).toFixed(1) : "0"

              const scoreColor =
                batch.qualityScore >= 90
                  ? "text-green-600"
                  : batch.qualityScore >= 70
                    ? "text-yellow-600"
                    : "text-red-600"

              return (
                <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{batch.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{batch.totalCaptures}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{batch.validCaptures}</td>
                  <td className="px-4 py-3 text-right text-slate-700 font-medium">{successRate}%</td>
                  <td className="px-4 py-3 text-right text-slate-700">{batch.defectCount}</td>
                  <td className={`px-4 py-3 text-right font-bold ${scoreColor}`}>
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