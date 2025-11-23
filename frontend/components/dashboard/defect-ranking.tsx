import { Trophy, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"

interface DefectRankingProps {
  data: {
    topDefects: Array<{
      rank: number
      code: string
      label: string
      count: number
      severity: number
      percentage: number
    }>
  }
}

export default function DefectRanking({ data }: DefectRankingProps) {
  const severityColors = {
    1: "bg-yellow-100 text-yellow-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-red-100 text-red-800",
    4: "bg-red-200 text-red-900",
    5: "bg-red-300 text-red-950",
  }

  const severityLabels = {
    1: "Baixa",
    2: "Média",
    3: "Alta",
    4: "Muito Alta",
    5: "Crítica",
  }

  return (
    <Card className="p-6 h-[500px]">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">Incidência de Defeitos</h3>
      </div>

      <div className="space-y-3">
        {data.topDefects.length === 0 ? (
          <div className="text-center py-8">
            <TrendingDown className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum defeito detectado</p>
          </div>
        ) : (
          data.topDefects.map((defect) => (
            <div
              key={defect.rank}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600 mr-4">#{defect.rank}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{defect.label}</p>
                    <p className="text-xs text-slate-500">{defect.code}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{defect.count}</p>
                <span
                  className={`text-xs px-2 py-1 rounded ${severityColors[defect.severity as keyof typeof severityColors]}`}
                >
                  {severityLabels[defect.severity as keyof typeof severityLabels]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}