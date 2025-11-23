"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
    ArrowLeft, 
    Download, 
    Image as ImageIcon,
    CheckCircle,
    XCircle,
    ChevronRight,
    BarChart3,
    Loader2,
    FileText,
    AlertTriangle,
} from "lucide-react"
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar } from "recharts"
import { getBatchDetails } from "@/lib/supabase/dashboard-service"
import type { Batch, Capture } from "@/lib/supabase/supabase"

interface ErrorDistributionItem {
    name: string
    count: number
}

interface CaptureWithDefects extends Capture {
    defects?: Array<{
        id: string
        defect_types: {
            code: string
            label: string
            severity: number
        }
    }>
}

const CustomErrorTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-lg text-white">
        <p className="text-sm font-semibold mb-1">{data.name}</p> 
        <p className="text-lg font-bold text-indigo-400">{data.count} ocorrências</p>
      </div>
    )
  }
  return null
}

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    
    const [batch, setBatch] = useState<Batch | null>(null)
    const [captures, setCaptures] = useState<CaptureWithDefects[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedCapture, setSelectedCapture] = useState<CaptureWithDefects | null>(null)
    const [processingType, setProcessingType] = useState<string>("original")
    const [downloading, setDownloading] = useState(false)

    useEffect(() => {
        loadBatchDetails()
    }, [resolvedParams.id])

    useEffect(() => {
        if (captures.length > 0 && !selectedCapture) {
            setSelectedCapture(captures[0])
        }
    }, [captures])

    const loadBatchDetails = async () => {
        try {
            setLoading(true)
            const data = await getBatchDetails(resolvedParams.id)
            setBatch(data.batch)
            setCaptures(data.captures as CaptureWithDefects[])
            setError(null)
        } catch (err) {
            console.error('Erro ao carregar detalhes:', err)
            setError(err instanceof Error ? err.message : "Erro ao carregar detalhes")
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadImages = async () => {
        if (!batch || captures.length === 0) return
        
        setDownloading(true)
        try {
            const JSZip = (await import('jszip')).default
            const zip = new JSZip()

            for (const capture of captures) {
                const captureFolder = zip.folder(capture.sha256)
                if (!captureFolder) continue
                
                const images = [
                    { url: capture.original_uri, name: 'original' },
                    { url: capture.processed_uri, name: 'caixas' },
                    { url: capture.processed_areas_uri, name: 'areas' },
                    { url: capture.processed_pins_uri, name: 'pins' },
                    { url: capture.processed_shaft_uri, name: 'hastes' },
                ]
                
                for (const img of images) {
                    if (img.url) {
                        try {
                            const response = await fetch(img.url)
                            if (response.ok) {
                                const blob = await response.blob()
                                captureFolder.file(`${img.name}.png`, blob)
                            }
                        } catch (err) {
                            console.warn(`Erro ao baixar ${img.name}:`, err)
                        }
                    }
                }
            }
            
            const folderName = batch.name.replace(/\s+/g, '_')
            const content = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(content)
            const a = document.createElement('a')
            a.href = url
            a.download = `${folderName}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
        } catch (err) {
            console.error('Erro ao baixar imagens:', err)
            alert('Erro ao baixar imagens. Tente novamente.')
        } finally {
            setDownloading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const calculateErrorDistribution = (): ErrorDistributionItem[] => {
        const defectCounts: Record<string, { name: string; count: number }> = {}
        
        captures.forEach(capture => {
            capture.defects?.forEach(defect => {
                const label = defect.defect_types.label
                if (!defectCounts[label]) {
                    defectCounts[label] = { name: label, count: 0 }
                }
                defectCounts[label].count++
            })
        })

        return Object.values(defectCounts).sort((a, b) => b.count - a.count)
    }

    const getCurrentImageUrl = () => {
        if (!selectedCapture) return null
        
        switch (processingType) {
            case "original":
                return selectedCapture.original_uri
            case "analise_pins":
                return selectedCapture.processed_pins_uri
            case "analise_caixa":
                return selectedCapture.processed_uri
            case "analise_areas":
                return selectedCapture.processed_areas_uri
            case "analise_hastes":
                return selectedCapture.processed_shaft_uri
            default:
                return selectedCapture.original_uri
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Carregando detalhes do lote...</p>
                </div>
            </div>
        )
    }

    if (error || !batch) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-900 font-medium mb-2">Erro ao carregar lote</p>
                    <p className="text-gray-600 text-sm">{error}</p>
                    <Button onClick={() => router.back()} className="mt-4">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                </div>
            </div>
        )
    }

    const errorDistribution = calculateErrorDistribution()
    const totalDefectTypes = errorDistribution.length
    const averageDefectsPerCapture = batch.total_captures > 0 
        ? batch.total_defects / batch.total_captures 
        : 0

    return (
      <div className="p-8">
          {/* Header */}
          <div className="mb-8">
              <Button 
                  variant="ghost" 
                  onClick={() => router.back()}
                  className="mb-4"
              >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
              </Button>

              <div className="flex items-start justify-between">
                  <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 tracking-wider">
                          <span>ADMIN</span>
                          <ChevronRight className="h-3 w-3 text-gray-500"/>
                          <span>LOTES</span>
                          <ChevronRight className="h-3 w-3 text-gray-500"/>
                          <span className="text-gray-700">DETALHES</span>
                      </div>
                      
                      {/* Título */}
                      <div className="flex items-center gap-4 mb-3">
                          <h1 className="text-3xl font-bold text-gray-900">{batch.name}</h1>
                          {/* @TODO: revisar a necessidade de um badge */}
                      </div>

                      {/* Descrição */}
                      {batch.description && (
                          <p className="text-gray-600 text-base my-3 max-w-2xl">
                              {batch.description}
                          </p>
                      )}

                      {/* Data de criação */}
                      <p className="text-gray-400 text-xs mt-3">
                          Processado em {formatDate(batch.created_at)}
                      </p>
                      <p className="text-gray-400 text-[10px] mt-2">
                        {batch.id}
                      </p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-3">
                      <Button 
                          onClick={handleDownloadImages}
                          disabled={downloading}
                          className="bg-blue-600 hover:bg-blue-700"
                      >
                          {downloading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                              <Download className="h-4 w-4 mr-2" />
                          )}
                          {downloading ? 'Baixando...' : 'Baixar Imagens'}
                      </Button>
                  </div>
              </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="border-gray-200">
                  <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                          <div>
                              <p className="text-sm text-gray-600">Capturas Totais</p>
                              <p className="text-3xl font-bold text-gray-900 mt-1">{batch.total_captures}</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                              <ImageIcon className="h-6 w-6 text-blue-600" />
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card className="border-gray-200">
                  <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                          <div>
                              <p className="text-sm text-gray-600">Válidas (Conforme)</p>
                              <p className="text-3xl font-bold text-green-600 mt-1">{batch.valid_captures}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                              <CheckCircle className="h-6 w-6 text-green-600" />
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card className="border-gray-200">
                  <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                          <div>
                              <p className="text-sm text-gray-600">Inválidas</p>
                              <p className="text-3xl font-bold text-red-600 mt-1">{batch.invalid_captures}</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg">
                              <XCircle className="h-6 w-6 text-red-600" />
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card className="border-gray-200">
                  <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                          <div>
                              <p className="text-sm text-gray-600">Score de Qualidade</p>
                              <p className="text-3xl font-bold text-gray-900 mt-1">
                                  {(batch.quality_score || 0).toFixed(1)}%
                              </p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                              <FileText className="h-6 w-6 text-purple-600" />
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>

          {/* Análise de Defeitos */}
          {batch.total_defects > 0 && (
              <div className="grid grid-cols-1 gap-6 mb-8">
                  <Card className="border-gray-200"> 
                      <CardHeader>
                          <CardTitle>Análise de Defeitos e Erros</CardTitle>
                          <CardDescription>Distribuição de ocorrências de defeitos por tipo.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          {/* Indicadores Chave */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                  <p className="text-xs text-red-600 font-medium">Ocorrências Totais</p>
                                  <p className="text-2xl font-bold text-red-900">{batch.total_defects}</p>
                              </div>
                              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                  <p className="text-xs text-indigo-600 font-medium">Tipos Distintos de Defeito</p>
                                  <p className="text-2xl font-bold text-indigo-900">{totalDefectTypes}</p>
                              </div>
                              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                  <p className="text-xs text-gray-600 font-medium">Média de Erros por Captura</p>
                                  <p className="text-2xl font-bold text-gray-900">{averageDefectsPerCapture.toFixed(2)}</p>
                              </div>
                          </div>

                          {/* Gráfico */}
                          {errorDistribution.length > 0 && (
                              <div className="h-96 w-full">
                                  <h4 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                      <BarChart3 className="h-4 w-4 text-slate-500" />
                                      Distribuição de Ocorrências
                                  </h4>
                                  <ResponsiveContainer width="100%" height="90%">
                                      <BarChart 
                                          data={errorDistribution} 
                                          layout="vertical"
                                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                      >
                                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                          <XAxis type="number" stroke="#94a3b8" />
                                          <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} />
                                          <Tooltip content={<CustomErrorTooltip />} />
                                          <Bar dataKey="count" fill="#193cb8" radius={[0, 6, 6, 0]} />
                                      </BarChart>
                                  </ResponsiveContainer>
                              </div>
                          )}
                      </CardContent>
                  </Card>
              </div>
          )}

          {/* Galeria de Imagens */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">                
              {/* Lista de Capturas */}
              <Card className="lg:col-span-1 border-gray-200">
                  <CardHeader>
                      <CardTitle>Galeria de Imagens</CardTitle>
                      <CardDescription>Imagens processadas neste lote ({batch.total_captures} total)</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                      
                      {/* Seletor de Tipo */}
                      <div>
                          <label className="text-sm font-medium text-gray-700">Tipo de Visualização</label>
                          <Select value={processingType} onValueChange={setProcessingType}>
                              <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Selecione o processamento" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="original">Original</SelectItem>
                                  <SelectItem value="analise_pins">Análise de Pins</SelectItem>
                                  <SelectItem value="analise_caixa">Análise da Caixa</SelectItem>
                                  <SelectItem value="analise_areas">Análise das Áreas</SelectItem>
                                  <SelectItem value="analise_hastes">Análise de Hastes</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>

                      {/* Lista de Previews */}
                      <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Todas as Capturas</h4>
                          <ScrollArea className="h-96 w-full rounded-md border p-2">
                              <div className="flex flex-col gap-3">
                                  {captures.map((capture, index) => (
                                      <button 
                                          key={capture.id} 
                                          className={`w-full p-2 rounded-lg border-2 flex items-center gap-3 text-left transition-all ${
                                              selectedCapture?.id === capture.id 
                                                  ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                                                  : 'border-transparent hover:bg-gray-100'
                                          }`}
                                          onClick={() => setSelectedCapture(capture)}
                                      >
                                          <div className={`flex-shrink-0 w-12 h-12 rounded-md flex items-center justify-center ${
                                              capture.is_valid ? 'bg-green-100' : 'bg-red-100'
                                          }`}>
                                              <ImageIcon className={`h-5 w-5 ${
                                                  capture.is_valid ? 'text-green-600' : 'text-red-600'
                                              }`} />
                                          </div>
                                          <div className="flex-1">
                                              <p className="text-sm font-semibold text-gray-900">
                                                  {capture.filename || `Captura ${index + 1}`}
                                              </p>
                                              <p className="text-xs text-gray-600">
                                                  {capture.is_valid 
                                                      ? 'Válida' 
                                                      : `Inválida • ${capture.defects_count || 0} defeitos`
                                                  }
                                              </p>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </ScrollArea>
                      </div>
                  </CardContent>
              </Card>

              {/* Visualizador de Imagem */}
              <div className="lg:col-span-2 bg-gray-900 rounded-lg min-h-[600px] relative overflow-hidden">
                  {selectedCapture && getCurrentImageUrl() ? (
                      <div className="relative w-full h-full min-h-[600px]">
                          <Image
                              src={getCurrentImageUrl() || ''}
                              alt={`Captura ${selectedCapture.filename}`}
                              fill
                              className="object-contain"
                              priority
                          />
                      </div>
                  ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-gray-400 p-4">
                              <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                              <p className="text-gray-500">Selecione uma captura para visualizar</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>
    )
}