"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import KPICards from "@/components/dashboard/kpi-cards"
import DefectRanking from "@/components/dashboard/defect-ranking"
import QualityCharts from "@/components/dashboard/quality-charts"
import BatchMetrics from "@/components/dashboard/batch-metrics"

interface DashboardMetrics {
  totalBatches: number;
  totalImages: number;
  validImages: number;
  totalDefects: number;
  qualityScore: number;
  defectTrends: { name: string; count: number; date: string }[];
  errorDistribution: { name: string; value: number }[];
  validityDistribution: { name: string; value: number; color: string }[];
  topDefects: {
    rank: number;
    code: string;
    label: string;
    count: number;
    severity: number;
    percentage: number;
  }[];
  recentBatches: {
    name: string;
    totalCaptures: number;
    validCaptures: number;
    qualityScore: number;
    defectCount: number;
  }[];
}

const mockData: DashboardMetrics = {
    totalBatches: 24,
    totalImages: 1240,
    validImages: 1089,
    totalDefects: 324,
    qualityScore: 87.8,

    defectTrends: [
        { name: "Seg", count: 12, date: "2024-01-01" },
        { name: "Ter", count: 19, date: "2024-01-02" },
        { name: "Qua", count: 15, date: "2024-01-03" },
        { name: "Qui", count: 25, date: "2024-01-04" },
        { name: "Sex", count: 18, date: "2024-01-05" },
        { name: "Sab", count: 22, date: "2024-01-06" },
        { name: "Dom", count: 11, date: "2024-01-07" },
    ],

    errorDistribution: [
        { name: "Pino Danificado", value: 95 },
        { name: "Cor Incorreta", value: 87 },
        { name: "Dano na Estrutura", value: 72 },
        { name: "Pino Faltante", value: 54 },
        { name: "Pino Extra", value: 16 },
    ],

    validityDistribution: [
        { name: "Válidas", value: 87.8, color: "#193cb8" },
        { name: "Inválidas", value: 12.2, color: "#ca3838ff" },
    ],

    topDefects: [
        {
            rank: 1,
            code: "PIN_DMG",
            label: "Pino Danificado",
            count: 95,
            severity: 4,
            percentage: 29.3,
        },
        {
            rank: 2,
            code: "WRONG_COLOR",
            label: "Cor Incorreta",
            count: 87,
            severity: 3,
            percentage: 26.8,
        },
        {
            rank: 3,
            code: "STRUCT_DMG",
            label: "Dano Estrutural",
            count: 72,
            severity: 5,
            percentage: 22.2,
        },
        {
            rank: 4,
            code: "PIN_MISS",
            label: "Pino Faltante",
            count: 54,
            severity: 4,
            percentage: 16.7,
        },
        {
            rank: 5,
            code: "PIN_EXTRA",
            label: "Pino Extra",
            count: 16,
            severity: 2,
            percentage: 4.9,
        },
    ],

    recentBatches: [
        {
            name: "BATCH-2024-001",
            totalCaptures: 120,
            validCaptures: 108,
            qualityScore: 90,
            defectCount: 12,
        },
        {
            name: "BATCH-2024-002",
            totalCaptures: 95,
            validCaptures: 85,
            qualityScore: 89.5,
            defectCount: 10,
        },
        {
            name: "BATCH-2024-003",
            totalCaptures: 140,
            validCaptures: 119,
            qualityScore: 85,
            defectCount: 21,
        },
        {
            name: "BATCH-2024-004",
            totalCaptures: 110,
            validCaptures: 98,
            qualityScore: 89,
            defectCount: 12,
        },
        {
            name: "BATCH-2024-005",
            totalCaptures: 125,
            validCaptures: 110,
            qualityScore: 88,
            defectCount: 15,
        },
    ],
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Simulação da chamada de API
        // const response = await fetch("/api/dashboard/metrics")
        // if (!response.ok) throw new Error("Failed to fetch metrics")
        // const data: DashboardMetrics = await response.json()
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setDashboardData(mockData) 
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header com Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 tracking-wider">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3 text-gray-500"/>
          <span className="text-gray-700">DASHBOARD</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 text-sm">Visualize métrica de todos os lotes de imagens processados pelo sistema</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      {dashboardData && <KPICards data={dashboardData} />}

      {/* Charts and Rankings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {dashboardData && (
          <>
            <div className="lg:col-span-2">
              <QualityCharts data={dashboardData} />
            </div>
            <div>
              <DefectRanking data={dashboardData} />
            </div>
          </>
        )}
      </div>

      {/* Batch Metrics */}
      {dashboardData && <BatchMetrics data={dashboardData} />}
    </div>
  )
}