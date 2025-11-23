import { supabase } from '@/lib/supabase/supabase'

export interface DashboardMetrics {
  totalBatches: number
  totalImages: number
  validImages: number
  totalDefects: number
  qualityScore: number
  defectTrends: { name: string; count: number; date: string }[]
  errorDistribution: { name: string; value: number }[]
  validityDistribution: { name: string; value: number; color: string }[]
  topDefects: {
    rank: number
    code: string
    label: string
    count: number
    severity: number
    percentage: number
  }[]
  recentBatches: {
    name: string
    totalCaptures: number
    validCaptures: number
    qualityScore: number
    defectCount: number
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const { data: batches, error: batchesError } = await supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (batchesError) throw batchesError

    const { data: captures, error: capturesError } = await supabase
      .from('captures')
      .select('*')

    if (capturesError) throw capturesError

    const { data: defects, error: defectsError } = await supabase
      .from('defects')
      .select(`
        *,
        defect_types (
          id,
          code,
          label,
          severity
        ),
        captures (
          created_at
        )
      `)

    if (defectsError) throw defectsError

    const { data: defectTypes, error: defectTypesError } = await supabase
      .from('defect_types')
      .select('*')

    if (defectTypesError) throw defectTypesError

    // ============ CALCULAR MÉTRICAS ============

    const totalBatches = batches?.length || 0
    const totalImages = captures?.length || 0
    const validImages = captures?.filter(c => c.is_valid).length || 0
    const totalDefects = defects?.length || 0
    
    // Quality Score médio de todos os batches
    const avgQualityScore = batches?.length 
      ? batches.reduce((sum, b) => sum + (b.quality_score || 0), 0) / batches.length 
      : 0

    // ============ TENDÊNCIA DE DEFEITOS (últimos 7 dias) ============
    
    const today = new Date()
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (6 - i))
      return date
    })

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    
    const defectTrends = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0]
      const defectsOnDay = defects?.filter(d => {
        const defectDate = new Date(d.captures?.created_at || d.created_at).toISOString().split('T')[0]
        return defectDate === dateStr
      }).length || 0

      return {
        name: dayNames[date.getDay()],
        count: defectsOnDay,
        date: dateStr
      }
    })

    // ============ DISTRIBUIÇÃO DE ERROS (Top 5) ============
    
    const defectCounts: Record<string, { label: string; count: number; severity: number }> = {}
    
    defects?.forEach(defect => {
      const type = defect.defect_types as any
      if (type) {
        if (!defectCounts[type.code]) {
          defectCounts[type.code] = {
            label: type.label,
            count: 0,
            severity: type.severity
          }
        }
        defectCounts[type.code].count++
      }
    })

    const errorDistribution = Object.entries(defectCounts)
      .map(([code, data]) => ({
        name: data.label,
        value: data.count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // ============ DISTRIBUIÇÃO DE VALIDADE ============
    
    const validPercentage = totalImages > 0 ? (validImages / totalImages) * 100 : 0
    const invalidPercentage = 100 - validPercentage

    const validityDistribution = [
      { name: 'Válidas', value: parseFloat(validPercentage.toFixed(1)), color: '#10b981' },
      { name: 'Inválidas', value: parseFloat(invalidPercentage.toFixed(1)), color: '#ef4444' }
    ]

    // ============ TOP DEFEITOS ============
    
    const topDefects = Object.entries(defectCounts)
      .map(([code, data]) => ({
        code,
        label: data.label,
        count: data.count,
        severity: data.severity,
        percentage: totalDefects > 0 ? (data.count / totalDefects) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        percentage: parseFloat(item.percentage.toFixed(1))
      }))

    // ============ LOTES RECENTES ============
    
    const recentBatches = (batches || [])
      .slice(0, 5)
      .map(batch => ({
        name: batch.name,
        totalCaptures: batch.total_captures,
        validCaptures: batch.valid_captures,
        qualityScore: parseFloat((batch.quality_score || 0).toFixed(1)),
        defectCount: batch.total_defects
      }))

    return {
      totalBatches,
      totalImages,
      validImages,
      totalDefects,
      qualityScore: parseFloat(avgQualityScore.toFixed(1)),
      defectTrends,
      errorDistribution,
      validityDistribution,
      topDefects,
      recentBatches
    }

  } catch (error) {
    console.error('Erro ao buscar métricas do dashboard:', error)
    throw error
  }
}

export async function getBatches(page: number = 1, pageSize: number = 10) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('batches')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  return {
    batches: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}

export async function getBatchDetails(batchId: string) {
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (batchError) throw batchError

  const { data: captures, error: capturesError } = await supabase
    .from('captures')
    .select(`
      *,
      compartments (*),
      defects (
        *,
        defect_types (*)
      )
    `)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false })

  if (capturesError) throw capturesError

  return {
    batch,
    captures: captures || []
  }
}

export async function deleteBatch(batchId: string) {
  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', batchId)

  if (error) throw error
}

export async function getDefectStatistics() {
  const { data: defects, error } = await supabase
    .from('defects')
    .select(`
      id,
      defect_types (
        code,
        label,
        severity
      )
    `)

  if (error) throw error

  const stats: Record<string, {
    code: string
    label: string
    severity: number
    count: number
  }> = {}

  defects?.forEach(defect => {
    const type = defect.defect_types as any
    if (type) {
      if (!stats[type.code]) {
        stats[type.code] = {
          code: type.code,
          label: type.label,
          severity: type.severity,
          count: 0
        }
      }
      stats[type.code].count++
    }
  })

  return Object.values(stats).sort((a, b) => b.count - a.count)
}