"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle2, XCircle, Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { cn } from "@/lib/utils"

interface PinClassification {
  total_pins: number
  valid_pins: number
  invalid_pins: number
  critical_pins: number
  damaged_threshold: number
  average_area: number
  details: {
    pins_ok: number
    pins_wrong_color: number
    pins_damaged_yellow: number
    pins_double_defect: number
  }
}

interface ShaftData {
  area: number
  length: number
  width: number
  straightness: number
  inclination_rad: number
  approved: boolean
  rejected_secondary: boolean
}

interface ShaftClassification {
  total_shafts: number
  approved_shafts: number
  rejected_shafts: number
  shafts: ShaftData[]
}

interface ProcessedImage {
  filename: string
  sha256: string
  timestamp: string
  original_url: string
  areas_url: string
  pins_url: string
  boxes_url: string
  shafts_url: string
  areas_count: number
  pins_count: number
  boxes_info: {
    total_boxes: number
    empty_boxes: number
    single_pin_boxes: number
    multiple_pins_boxes: number
    boxes: Array<{
      x: number
      y: number
      width: number
      height: number
      pins_count: number
      status: "empty" | "single" | "multiple"
    }>
  }
  pin_classification: PinClassification
  shaft_classification: ShaftClassification
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export default function ResultsPage() {
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [selectedView, setSelectedView] = useState<string>("boxes")
  const [loteName, setLoteName] = useState<string>("")
  const [loteDescription, setLoteDescription] = useState<string>("")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const loadData = () => {
      try {
        const savedData = sessionStorage.getItem("processedImages")
        const usingGlobal = sessionStorage.getItem("usingGlobalMemory")

        if (savedData) {
          const parsedData = JSON.parse(savedData)
          setImages(parsedData)
        } else if (usingGlobal === "true" && (window as any).globalProcessedImages) {
          setImages((window as any).globalProcessedImages)
        } else {
          router.push("/")
          return
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
        router.push("/")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])
  
  const selectedImage = images[selectedImageIndex]

  const handleAprovarLote = async () => {
    if (!loteName.trim()) {
      alert("Por favor, preencha o nome do lote")
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      // Preparar dados para API
      const capturesData = images.map(img => {
        // Extrair path relativo removendo a URL base do Supabase
        const extractPath = (url: string) => {
          const parts = url.split('/pipeline-temp/')
          return parts.length > 1 ? parts[1] : url
        }

        // Calcular grid_row e grid_col baseado no índice da box
        const compartments = img.boxes_info.boxes.map((box, index) => {
          const cols = Math.ceil(Math.sqrt(img.boxes_info.total_boxes))
          return {
            grid_row: Math.floor(index / cols),
            grid_col: index % cols,
            bbox_x: box.x,
            bbox_y: box.y,
            bbox_width: box.width,
            bbox_height: box.height,
            pins_count: box.pins_count,
            is_valid: box.status === "single",
            has_defect: box.status !== "single"
          }
        })

        // Calcular defeitos corretamente
        const emptyBoxes = img.boxes_info.empty_boxes || 0
        const multipleBoxes = img.boxes_info.multiple_pins_boxes || 0
        const invalidPins = img.pin_classification?.invalid_pins || 0
        const criticalPins = img.pin_classification?.critical_pins || 0
        const rejectedShafts = img.shaft_classification?.rejected_shafts || 0
        
        const totalDefects = emptyBoxes + multipleBoxes + invalidPins + criticalPins + rejectedShafts
        const isValid = totalDefects === 0

        return {
          filename: img.filename,
          sha256: img.sha256,
          original_uri: extractPath(img.original_url),
          processed_uri: extractPath(img.boxes_url),
          processed_areas_uri: extractPath(img.areas_url),
          processed_pins_uri: extractPath(img.pins_url),
          processed_shaft_uri: extractPath(img.shafts_url),
          is_valid: isValid,
          areas_detected: img.areas_count,
          pins_detected: img.pins_count,
          defects_count: totalDefects,
          has_missing_pins: emptyBoxes > 0,
          has_extra_pins: multipleBoxes > 0,
          has_damaged_pins: (img.pin_classification?.details?.pins_damaged_yellow || 0) > 0,
          has_wrong_color_pins: (img.pin_classification?.details?.pins_wrong_color || 0) > 0,
          has_structure_damage: false,
          has_shaft_defects: rejectedShafts > 0,
          compartments: compartments
        }
      })

      const requestData = {
        name: loteName,
        description: loteDescription,
        captures: capturesData
      }

      console.log("📤 Enviando lote para aprovação:")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      console.log("📦 Nome do Lote:", loteName)
      console.log("📝 Descrição:", loteDescription)
      console.log("🖼️  Total de Captures:", capturesData.length)
      console.log("\n📊 Resumo de Defeitos por Capture:")
      capturesData.forEach((capture, index) => {
        console.log(`\n  Imagem ${index + 1}: ${capture.filename}`)
        console.log(`    ✓ Válida: ${capture.is_valid ? '✅ Sim' : '❌ Não'}`)
        console.log(`    📍 Áreas detectadas: ${capture.areas_detected}`)
        console.log(`    📌 Pins detectados: ${capture.pins_detected}`)
        console.log(`    ⚠️  Total de defeitos: ${capture.defects_count}`)
        console.log(`    🔴 Missing pins: ${capture.has_missing_pins ? 'Sim' : 'Não'}`)
        console.log(`    🟠 Extra pins: ${capture.has_extra_pins ? 'Sim' : 'Não'}`)
        console.log(`    🟡 Damaged pins: ${capture.has_damaged_pins ? 'Sim' : 'Não'}`)
        console.log(`    🟣 Wrong color pins: ${capture.has_wrong_color_pins ? 'Sim' : 'Não'}`)
        console.log(`    🔧 Shaft defects: ${capture.has_shaft_defects ? 'Sim' : 'Não'}`)
        console.log(`    📦 Compartimentos: ${capture.compartments.length}`)
        console.log(`    ├─ Válidos: ${capture.compartments.filter(c => c.is_valid).length}`)
        console.log(`    └─ Com defeito: ${capture.compartments.filter(c => c.has_defect).length}`)
      })
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      const response = await fetch(`${API_URL}/api/batches/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log("✅ Lote aprovado com sucesso:", result)

      setSaveSuccess(true)
      
      setTimeout(() => {
        sessionStorage.removeItem("processedImages")
        sessionStorage.removeItem("usingGlobalMemory")
        router.push("/admin/batches")
      }, 2000)

    } catch (error) {
      console.error("❌ Erro ao aprovar lote:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar lote"
      setSaveError(errorMessage)
      alert(`Erro ao aprovar o lote: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejeitarLote = async () => {
    if (!confirm("Tem certeza que deseja rejeitar este lote? As imagens processadas serão permanentemente deletadas.")) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const timestamp = images[0]?.timestamp

      if (!timestamp) {
        throw new Error("Timestamp não encontrado")
      }

      console.log("📤 Rejeitando lote com timestamp:", timestamp)

      const response = await fetch(`${API_URL}/api/batches/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log("✅ Lote rejeitado com sucesso:", result)

      sessionStorage.removeItem("processedImages")
      sessionStorage.removeItem("usingGlobalMemory")
      router.push("/")

    } catch (error) {
      console.error("❌ Erro ao rejeitar lote:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao rejeitar lote"
      setSaveError(errorMessage)
      alert(`Erro ao rejeitar o lote: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  const getOccupancyRate = (boxesInfo: ProcessedImage["boxes_info"]) => {
    if (!boxesInfo || boxesInfo.total_boxes === 0) return 0
    return ((boxesInfo.single_pin_boxes + boxesInfo.multiple_pins_boxes) / boxesInfo.total_boxes * 100).toFixed(1)
  }

  const getEfficiencyRate = (boxesInfo: ProcessedImage["boxes_info"]) => {
    if (!boxesInfo || boxesInfo.total_boxes === 0) return 0
    return (boxesInfo.single_pin_boxes / boxesInfo.total_boxes * 100).toFixed(1)
  }

  const getPinQualityRate = (pinClass: PinClassification) => {
    if (!pinClass || pinClass.total_pins === 0) return 0
    return (pinClass.valid_pins / pinClass.total_pins * 100).toFixed(1)
  }

  const getShaftQualityRate = (shaftClass: ShaftClassification) => {
    if (!shaftClass || shaftClass.total_shafts === 0) return 0
    return (shaftClass.approved_shafts / shaftClass.total_shafts * 100).toFixed(1)
  }

  if (isLoading || !selectedImage) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Carregando resultados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen flex flex-col", isDarkMode && "dark")}>
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      
      <main className="flex-1 container mx-auto py-8 px-4">
        {saveSuccess && (
          <Alert className="mb-6 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-600 dark:text-green-400">
              Lote aprovado com sucesso! Redirecionando...
            </AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert className="mb-6 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-600 dark:text-red-400">
              {saveError}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Visualização dos Resultados
                </CardTitle>
                <CardDescription>
                  Imagem {selectedImageIndex + 1} de {images.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Visualização</Label>
                  <Select value={selectedView} onValueChange={setSelectedView}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Original</SelectItem>
                      <SelectItem value="areas">Áreas Detectadas</SelectItem>
                      <SelectItem value="pins">Pins Detectados</SelectItem>
                      <SelectItem value="boxes">Análise de Caixas</SelectItem>
                      <SelectItem value="shafts">Hastes Detectadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <Image
                    src={
                      selectedView === "original" ? selectedImage.original_url :
                      selectedView === "areas" ? selectedImage.areas_url :
                      selectedView === "pins" ? selectedImage.pins_url :
                      selectedView === "shafts" ? selectedImage.shafts_url :
                      selectedImage.boxes_url
                    }
                    alt={`Resultado ${selectedView}`}
                    fill
                    className="object-contain"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={cn(
                        "min-w-[80px] h-20 rounded-lg border-2 transition-all",
                        selectedImageIndex === index
                          ? "border-primary"
                          : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          src={images[index].original_url}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className="object-cover rounded-md"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análise Detalhada</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="compartments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="compartments">Compartimentos</TabsTrigger>
                    <TabsTrigger value="pins">Pins</TabsTrigger>
                    <TabsTrigger value="shafts">Hastes</TabsTrigger>
                  </TabsList>

                  {/* Tab Compartimentos */}
                  <TabsContent value="compartments" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedImage.areas_count}
                        </div>
                        <div className="text-xs text-muted-foreground">Áreas</div>
                      </div>
                      <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/30 rounded">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedImage.pins_count}
                        </div>
                        <div className="text-xs text-muted-foreground">Pins Total</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {selectedImage.boxes_info?.empty_boxes || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Vazias</div>
                      </div>
                      <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedImage.boxes_info?.single_pin_boxes || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">1 Pin</div>
                      </div>
                      <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {selectedImage.boxes_info?.multiple_pins_boxes || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Múltiplos</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de Ocupação:</span>
                        <span className="font-semibold">{getOccupancyRate(selectedImage.boxes_info)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Eficiência (1 pin):</span>
                        <span className="font-semibold">{getEfficiencyRate(selectedImage.boxes_info)}%</span>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab Pins */}
                  <TabsContent value="pins" className="space-y-4">
                    {selectedImage.pin_classification ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {selectedImage.pin_classification.valid_pins}
                            </div>
                            <div className="text-xs text-muted-foreground">Válidos</div>
                          </div>
                          <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {selectedImage.pin_classification.invalid_pins}
                            </div>
                            <div className="text-xs text-muted-foreground">Inválidos</div>
                          </div>
                          <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {selectedImage.pin_classification.critical_pins}
                            </div>
                            <div className="text-xs text-muted-foreground">Críticos</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 p-3 bg-muted rounded">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cor Errada:</span>
                            <span className="font-semibold">{selectedImage.pin_classification.details.pins_wrong_color}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Danificados (Amarelo):</span>
                            <span className="font-semibold">{selectedImage.pin_classification.details.pins_damaged_yellow}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Defeito Duplo:</span>
                            <span className="font-semibold">{selectedImage.pin_classification.details.pins_double_defect}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxa de Qualidade:</span>
                            <span className={cn(
                              "font-semibold flex items-center gap-1",
                              Number(getPinQualityRate(selectedImage.pin_classification)) >= 90 ? "text-green-600" : "text-orange-600"
                            )}>
                              {getPinQualityRate(selectedImage.pin_classification)}%
                              {Number(getPinQualityRate(selectedImage.pin_classification)) >= 90 ? 
                                <TrendingUp className="h-3 w-3" /> : 
                                <TrendingDown className="h-3 w-3" />
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Área Média:</span>
                            <span className="font-semibold">{selectedImage.pin_classification.average_area.toFixed(2)} px²</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Limiar de Dano:</span>
                            <span className="font-semibold">{selectedImage.pin_classification.damaged_threshold.toFixed(2)} px²</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        Dados de classificação de pins não disponíveis
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab Hastes */}
                  <TabsContent value="shafts" className="space-y-4">
                    {selectedImage.shaft_classification ? (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {selectedImage.shaft_classification.total_shafts}
                            </div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {selectedImage.shaft_classification.approved_shafts}
                            </div>
                            <div className="text-xs text-muted-foreground">Aprovadas</div>
                          </div>
                          <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {selectedImage.shaft_classification.rejected_shafts}
                            </div>
                            <div className="text-xs text-muted-foreground">Reprovadas</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxa de Aprovação:</span>
                            <span className={cn(
                              "font-semibold flex items-center gap-1",
                              Number(getShaftQualityRate(selectedImage.shaft_classification)) >= 90 ? "text-green-600" : "text-orange-600"
                            )}>
                              {getShaftQualityRate(selectedImage.shaft_classification)}%
                              {Number(getShaftQualityRate(selectedImage.shaft_classification)) >= 90 ? 
                                <TrendingUp className="h-3 w-3" /> : 
                                <TrendingDown className="h-3 w-3" />
                              }
                            </span>
                          </div>
                        </div>

                        {selectedImage.shaft_classification.shafts.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold">Detalhes das Hastes:</div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {selectedImage.shaft_classification.shafts.map((shaft, idx) => (
                                <div key={idx} className={cn(
                                  "p-2 rounded text-xs",
                                  shaft.approved 
                                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                    : shaft.rejected_secondary
                                    ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                )}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold">Haste {idx + 1}</span>
                                    {shaft.approved ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-red-600" />
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                                    <div>Comprimento: {shaft.length.toFixed(1)}px</div>
                                    <div>Largura: {shaft.width.toFixed(1)}px</div>
                                    <div>Linearidade: {shaft.straightness.toFixed(2)}</div>
                                    <div>Área: {shaft.area.toFixed(1)}px²</div>
                                  </div>
                                  {shaft.rejected_secondary && (
                                    <div className="mt-1 text-purple-600 dark:text-purple-400 font-semibold">
                                      Reprovada: Critério Secundário
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        Dados de hastes não disponíveis
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-3 bg-primary/10 rounded">
                  <div className="text-3xl font-bold text-primary">
                    {images.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Imagens</div>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Compartimentos</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">
                        {images.reduce((sum, img) => sum + img.areas_count, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Áreas</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">
                        {images.reduce((sum, img) => sum + img.pins_count, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Pins</div>
                    </div>
                    <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {images.reduce((sum, img) => sum + (img.boxes_info?.empty_boxes || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Vazias</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Qualidade dos Pins</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {images.reduce((sum, img) => sum + (img.pin_classification?.valid_pins || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Válidos</div>
                    </div>
                    <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {images.reduce((sum, img) => sum + (img.pin_classification?.invalid_pins || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Inválidos</div>
                    </div>
                    <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {images.reduce((sum, img) => sum + (img.pin_classification?.critical_pins || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Críticos</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Hastes</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {images.reduce((sum, img) => sum + (img.shaft_classification?.approved_shafts || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Aprovadas</div>
                    </div>
                    <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {images.reduce((sum, img) => sum + (img.shaft_classification?.rejected_shafts || 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Reprovadas</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações do Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lote-name">Nome do Lote *</Label>
                  <Input
                    id="lote-name"
                    placeholder="Ex: Lote A-001"
                    value={loteName}
                    onChange={(e) => setLoteName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lote-description">Descrição</Label>
                  <Textarea
                    id="lote-description"
                    placeholder="Observações sobre o lote..."
                    value={loteDescription}
                    onChange={(e) => setLoteDescription(e.target.value)}
                    disabled={isSaving}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button
                  className="w-full"
                  onClick={handleAprovarLote}
                  disabled={isSaving || !loteName.trim()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar Lote
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRejeitarLote}
                  disabled={isSaving}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeitar Lote
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}