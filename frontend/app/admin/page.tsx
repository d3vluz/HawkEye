"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import KPICards from "@/components/dashboard/kpi-cards"
import DefectRanking from "@/components/dashboard/defect-ranking"
import QualityCharts from "@/components/dashboard/quality-charts"
import BatchMetrics from "@/components/dashboard/batch-metrics"
import { getDashboardMetrics, type DashboardMetrics } from "@/lib/supabase/dashboard-service"

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const data = await getDashboardMetrics()
        setDashboardData(data)
        setError(null)
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
        setError(err instanceof Error ? err.message : "Erro ao carregar métricas")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()

    const interval = setInterval(fetchDashboardData, 30000)
    
    return () => clearInterval(interval)
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

      {!dashboardData && !loading && (
        <div className="mb-6 p-8 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-800 font-medium mb-2">Nenhum dado disponível</p>
          <p className="text-blue-600 text-sm">Processe alguns lotes para visualizar as métricas</p>
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