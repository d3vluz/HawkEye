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

type Accent = "signal" | "success" | "danger"

const accentClasses: Record<Accent, { border: string; icon: string }> = {
  signal: { border: "border-l-signal", icon: "text-signal" },
  success: { border: "border-l-success", icon: "text-success-emphasis" },
  danger: { border: "border-l-danger", icon: "text-danger-emphasis" },
}

export default function KPICards({ data }: KPICardsProps) {
  const invalidImages = data.totalImages - data.validImages
  const successRate = data.totalImages > 0 ? ((data.validImages / data.totalImages) * 100).toFixed(2) : 0

  const kpis: Array<{
    label: string
    value: number
    subtext?: string
    icon: typeof Package
    accent: Accent
  }> = [
    { label: "Total de Lotes", value: data.totalBatches, icon: Package, accent: "signal" },
    { label: "Total de Imagens", value: data.totalImages, icon: ImageIcon, accent: "signal" },
    {
      label: "Imagens Válidas",
      value: data.validImages,
      subtext: `${successRate}%`,
      icon: CheckIcon,
      accent: "success",
    },
    {
      label: "Defeitos Detectados",
      value: data.totalDefects,
      subtext: invalidImages > 0 ? `${(data.totalDefects / invalidImages).toFixed(1)} por imagem` : "0",
      icon: AlertCircle,
      accent: "danger",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        const accent = accentClasses[kpi.accent]
        return (
          <div
            key={idx}
            className={`bg-card border border-border border-l-4 ${accent.border} rounded-lg p-6 transition-shadow hover:shadow-[0_4px_16px_rgba(13,17,23,0.35)]`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                  {kpi.value.toLocaleString("pt-BR")}
                </p>
                {kpi.subtext && <p className="text-xs text-muted-foreground mt-2 tabular-nums">{kpi.subtext}</p>}
              </div>
              <Icon className={`w-8 h-8 ${accent.icon}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
