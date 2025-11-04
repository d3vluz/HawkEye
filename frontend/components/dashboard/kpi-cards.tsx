import { Package, ImageIcon, CheckIcon, AlertCircle } from "lucide-react"

interface KPICardsProps {
  data: {
    totalBatches: number
    totalImages: number
    validImages: number
    totalDefects: number
    qualityScore: number
  }
}

export default function KPICards({ data }: KPICardsProps) {
  const invalidImages = data.totalImages - data.validImages
  const successRate = data.totalImages > 0 ? ((data.validImages / data.totalImages) * 100).toFixed(2) : 0

  const kpis = [
    {
      label: "Total de Lotes",
      value: data.totalBatches,
      icon: Package,
      color: "bg-blue-50 text-blue-600",
      borderColor: "border-blue-800",
    },
    {
      label: "Total de Imagens",
      value: data.totalImages,
      icon: ImageIcon,
      color: "bg-blue-50 text-blue-600",
      borderColor: "border-blue-800",
    },
    {
      label: "Imagens Válidas",
      value: data.validImages,
      subtext: `${successRate}%`,
      icon: CheckIcon,
      color: "bg-blue-50 text-blue-600",
      borderColor: "border-blue-800",
    },
    {
      label: "Defeitos Detectados",
      value: data.totalDefects,
      subtext: invalidImages > 0 ? `${(data.totalDefects / invalidImages).toFixed(1)} por imagem` : "0",
      icon: AlertCircle,
      color: "bg-blue-600 text-blue-600",
      borderColor: "border-blue-800",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        return (
          <div
            key={idx}
            className={`${kpi.color} border-l-4 ${kpi.borderColor} bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{kpi.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{kpi.value.toLocaleString("pt-BR")}</p>
                {kpi.subtext && <p className="text-xs text-slate-500 mt-2">{kpi.subtext}</p>}
              </div>
              <Icon className="w-8 h-8 opacity-60" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
