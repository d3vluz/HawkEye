"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, CheckCircle2, XCircle, Package, AlertTriangle, 
  LayoutGrid, ZoomIn, Ruler, AlertOctagon, Activity, Hash, Maximize2, Crosshair
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { cn } from "@/lib/utils"

// --- INTERFACES ---
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
  const [selectedView, setSelectedView] = useState<string>("original")
  const [loteName, setLoteName] = useState<string>("")
  const [loteDescription, setLoteDescription] = useState<string>("")
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

  const calculateShaftAverages = (shaftClass?: ShaftClassification) => {
    if (!shaftClass || shaftClass.total_shafts === 0) {
      return { length: 0, straightness: 0 }
    }
    const totalLen = shaftClass.shafts.reduce((acc, s) => acc + s.length, 0)
    const totalStr = shaftClass.shafts.reduce((acc, s) => acc + s.straightness, 0)
    return {
      length: totalLen / shaftClass.total_shafts,
      straightness: totalStr / shaftClass.total_shafts
    }
  }

  // --- Ações ---
  const handleAprovarLote = async () => {
    if (!loteName.trim()) {
      alert("Por favor, preencha o nome do lote")
      return
    }
    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const capturesData = images.map(img => {
        const extractPath = (url: string) => {
          const parts = url.split('/pipeline-temp/')
          return parts.length > 1 ? parts[1] : url
        }

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

        const emptyBoxes = img.boxes_info.empty_boxes || 0
        const multipleBoxes = img.boxes_info.multiple_pins_boxes || 0
        const invalidPins = img.pin_classification?.invalid_pins || 0
        const criticalPins = img.pin_classification?.critical_pins || 0
        const rejectedShafts = img.shaft_classification?.rejected_shafts || 0
        const totalDefects = emptyBoxes + multipleBoxes + invalidPins + criticalPins + rejectedShafts

        return {
          filename: img.filename,
          sha256: img.sha256,
          original_uri: extractPath(img.original_url),
          processed_uri: extractPath(img.boxes_url),
          processed_areas_uri: extractPath(img.areas_url),
          processed_pins_uri: extractPath(img.pins_url),
          processed_shaft_uri: extractPath(img.shafts_url),
          is_valid: totalDefects === 0,
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

      const requestData = { name: loteName, description: loteDescription, captures: capturesData }

      const response = await fetch(`${API_URL}/api/batches/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) throw new Error("Erro ao salvar lote")

      setSaveSuccess(true)
      setTimeout(() => {
        sessionStorage.removeItem("processedImages")
        sessionStorage.removeItem("usingGlobalMemory")
        router.push("/admin/batches")
      }, 2000)

    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejeitarLote = async () => {
    if (!confirm("Tem certeza? Isso apagará as imagens permanentemente.")) return
    setIsSaving(true)
    try {
      const timestamp = images[0]?.timestamp
      if (!timestamp) throw new Error("Timestamp inválido")
      await fetch(`${API_URL}/api/batches/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp })
      })
      sessionStorage.removeItem("processedImages")
      sessionStorage.removeItem("usingGlobalMemory")
      router.push("/")
    } catch (error) {
      setSaveError("Erro ao rejeitar lote")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !selectedImage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Carregando análise...</p>
        </div>
      </div>
    )
  }

  const totalDefectsCurrent = 
    (selectedImage.boxes_info?.empty_boxes || 0) +
    (selectedImage.boxes_info?.multiple_pins_boxes || 0) +
    (selectedImage.pin_classification?.invalid_pins || 0) +
    (selectedImage.pin_classification?.critical_pins || 0) +
    (selectedImage.shaft_classification?.rejected_shafts || 0)

  const isCurrentValid = totalDefectsCurrent === 0
  const shaftStats = calculateShaftAverages(selectedImage.shaft_classification)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      
      <main className="flex-1 container mx-auto py-6 px-4 lg:px-8 space-y-6">
        {saveSuccess && (
          <Alert className="bg-green-500/15 border-green-500/50 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Lote processado e aprovado com sucesso!</AlertDescription>
          </Alert>
        )}
        {saveError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
          
          {/* --- COLUNA ESQUERDA --- */}
          <Card className="lg:col-span-8 flex flex-col border shadow-sm overflow-hidden h-full">
            <CardHeader className="px-6 py-4 border-b bg-muted/40 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-8 rounded-full", isCurrentValid ? "bg-green-500" : "bg-red-500")} />
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    {selectedImage.filename}
                    {!isCurrentValid && <Badge variant="destructive" className="ml-2">Com Defeitos</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedImage.sha256.substring(0, 12)}...</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-background p-1 rounded-lg border">
                <Select value={selectedView} onValueChange={setSelectedView}>
                  <SelectTrigger className="w-[160px] h-8 border-0 focus:ring-0 bg-transparent">
                    <div className="flex items-center gap-2">
                      <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">🖼️ Original</SelectItem>
                    <SelectItem value="pins">📌 Pins</SelectItem>
                    <SelectItem value="areas">📐 Áreas</SelectItem>
                    <SelectItem value="boxes">📦 Caixas</SelectItem>
                    <SelectItem value="shafts">📏 Hastes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 bg-muted/10 relative p-0 flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full p-4">
                <Image
                  src={
                    selectedView === "original" ? selectedImage.original_url :
                    selectedView === "areas" ? selectedImage.areas_url :
                    selectedView === "pins" ? selectedImage.pins_url :
                    selectedView === "shafts" ? selectedImage.shafts_url :
                    selectedImage.boxes_url
                  }
                  alt="Visualização"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </CardContent>
          </Card>

          {/* --- COLUNA DIREITA --- */}
          <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
            
            {/* Horizontal Scroll */}
            <Card className="flex-shrink-0 flex flex-col shadow-sm">
              <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <LayoutGrid className="h-3 w-3" /> Navegação
                </span>
                <span className="text-xs text-muted-foreground">{selectedImageIndex + 1} / {images.length}</span>
              </div>
              <div className="w-full">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2 p-3 items-center">
                        {images.map((img, index) => (
                            <button
                            key={index}
                            onClick={() => setSelectedImageIndex(index)}
                            className={cn(
                                "relative w-[70px] h-[70px] flex-shrink-0 rounded-md overflow-hidden border-2 transition-all",
                                selectedImageIndex === index
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-transparent opacity-60 hover:opacity-100"
                            )}
                            >
                            <Image src={img.original_url} alt="" fill className="object-cover" />
                            <div className={cn(
                                "absolute top-1 right-1 w-2 h-2 rounded-full z-10",
                                (img.pin_classification?.critical_pins || 0) > 0 ? "bg-red-500" : "bg-green-500"
                            )} />
                            </button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </Card>

            {/* Detalhes / Tabs */}
            <Card className="flex-1 flex flex-col shadow-sm overflow-hidden border-t-4 border-t-primary/50">
              <Tabs defaultValue="stats" className="flex flex-col h-full">
                
                <div className="px-4 py-2 border-b bg-muted/40 flex-shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="stats" className="text-xs">Geral</TabsTrigger>
                    <TabsTrigger value="defects" className="text-xs">Defeitos</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                    
                  {/* ABA GERAL */}
                  <TabsContent value="stats" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <ScrollArea className="flex-1 w-full">
                      <div className="p-4 space-y-4">
                        
                        {/* 1. Grid Unificado */}
                        <div className="grid grid-cols-2 gap-3">
                           <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pins</p>
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedImage.pins_count}</p>
                           </div>
                           <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Áreas</p>
                              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedImage.areas_count}</p>
                           </div>

                           {/* Título Metrologia Pins */}
                           <h4 className="text-xs font-semibold flex items-center gap-2 text-primary uppercase tracking-wide col-span-2 mt-2">
                             <Crosshair className="w-3.5 h-3.5" /> Metrologia dos Pins
                           </h4>

                           <div className="p-3 rounded-lg bg-muted/40 border border-dashed">
                              <div className="flex items-center gap-1 mb-1">
                                <Maximize2 className="w-3 h-3 text-muted-foreground"/>
                                <p className="text-[10px] text-muted-foreground uppercase">Área Média</p>
                              </div>
                              <p className="text-lg font-mono font-medium truncate">
                                  {selectedImage.pin_classification?.average_area.toFixed(0)} px²
                              </p>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/40 border border-dashed">
                              <div className="flex items-center gap-1 mb-1">
                                <AlertTriangle className="w-3 h-3 text-muted-foreground"/>
                                <p className="text-[10px] text-muted-foreground uppercase">Limiar</p>
                              </div>
                              <p className="text-lg font-mono font-medium text-muted-foreground truncate">
                                  {selectedImage.pin_classification?.damaged_threshold.toFixed(0)} px²
                              </p>
                           </div>
                        </div>

                        {/* 2. Metrologia das HASTES */}
                        <div className="space-y-2 pt-2 border-t border-dashed">
                           <h4 className="text-xs font-semibold flex items-center gap-2 text-primary uppercase tracking-wide">
                             <Ruler className="w-3.5 h-3.5" /> Análise Dimensional (Hastes)
                           </h4>
                           <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-muted/40 p-2 rounded border border-dashed">
                                 <div className="flex justify-center mb-1"><Hash className="w-3 h-3 text-muted-foreground"/></div>
                                 <div className="font-bold font-mono">{selectedImage.shaft_classification?.total_shafts || 0}</div>
                                 <div className="text-[9px] uppercase text-muted-foreground mt-0.5">Qtd</div>
                              </div>
                              <div className="bg-muted/40 p-2 rounded border border-dashed">
                                 <div className="flex justify-center mb-1"><Ruler className="w-3 h-3 text-muted-foreground"/></div>
                                 <div className="font-bold font-mono">{shaftStats.length.toFixed(1)}px</div>
                                 <div className="text-[9px] uppercase text-muted-foreground mt-0.5">Comp.</div>
                              </div>
                              <div className="bg-muted/40 p-2 rounded border border-dashed">
                                 <div className="flex justify-center mb-1"><Activity className="w-3 h-3 text-muted-foreground"/></div>
                                 <div className="font-bold font-mono">{shaftStats.straightness.toFixed(2)}</div>
                                 <div className="text-[9px] uppercase text-muted-foreground mt-0.5">Retidão</div>
                              </div>
                           </div>
                        </div>

                        {/* 3. Ocupação */}
                        <div className="space-y-2 pt-2 border-t border-dashed pb-2">
                           <h4 className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wide">
                             <Package className="w-3.5 h-3.5" /> Ocupação
                           </h4>
                           <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-muted p-2 rounded">
                                 <div className="font-bold text-lg">{selectedImage.boxes_info?.single_pin_boxes}</div>
                                 <div className="text-[10px] text-muted-foreground">1 Pin</div>
                              </div>
                              <div className={cn("p-2 rounded bg-muted", (selectedImage.boxes_info?.empty_boxes || 0) > 0 && "bg-red-100 dark:bg-red-900/20 text-red-600")}>
                                 <div className="font-bold text-lg">{selectedImage.boxes_info?.empty_boxes}</div>
                                 <div className="text-[10px]">Vazias</div>
                              </div>
                              <div className={cn("p-2 rounded bg-muted", (selectedImage.boxes_info?.multiple_pins_boxes || 0) > 0 && "bg-orange-100 dark:bg-orange-900/20 text-orange-600")}>
                                 <div className="font-bold text-lg">{selectedImage.boxes_info?.multiple_pins_boxes}</div>
                                 <div className="text-[10px]">Extras</div>
                              </div>
                           </div>
                        </div>

                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* ABA DEFEITOS */}
                  <TabsContent value="defects" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <ScrollArea className="flex-1 w-full">
                      <div className="p-4 space-y-4">
                        {totalDefectsCurrent === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center h-full">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mb-2 opacity-50" />
                            <p>Nenhum defeito encontrado nesta imagem.</p>
                          </div>
                        ) : (
                          <div className="space-y-3 pb-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lista de Ocorrências</h4>
                            
                            {(selectedImage.boxes_info?.empty_boxes || 0) > 0 && (
                              <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50">
                                <AlertOctagon className="w-4 h-4 text-red-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Compartimentos Vazios</p>
                                  <p className="text-xs text-red-600/80">{selectedImage.boxes_info.empty_boxes} caixas sem pin</p>
                                </div>
                              </div>
                            )}

                            {(selectedImage.pin_classification?.details.pins_wrong_color || 0) > 0 && (
                              <div className="flex items-start gap-3 p-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50">
                                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Cor Incorreta</p>
                                  <p className="text-xs text-orange-600/80">{selectedImage.pin_classification.details.pins_wrong_color} pins com cor divergente</p>
                                </div>
                              </div>
                            )}

                            {(selectedImage.pin_classification?.details.pins_damaged_yellow || 0) > 0 && (
                              <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/50">
                                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Pins Danificados</p>
                                  <p className="text-xs text-yellow-600/80">{selectedImage.pin_classification.details.pins_damaged_yellow} cabeças deformadas</p>
                                </div>
                              </div>
                            )}

                             {(selectedImage.shaft_classification?.rejected_shafts || 0) > 0 && (
                              <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50">
                                <Ruler className="w-4 h-4 text-red-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Falha Dimensional</p>
                                  <p className="text-xs text-red-600/80">{selectedImage.shaft_classification.rejected_shafts} hastes fora da tolerância</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                </div>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* --- RODAPÉ --- */}
        <Card className="bg-card border-t shadow-md">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-6 gap-6">
            
            <div className="flex items-center gap-8">
               <div>
                 <Label className="text-xs text-muted-foreground uppercase">Status do Lote</Label>
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                   {images.length} Imagens
                 </h2>
               </div>
               <div className="h-10 w-px bg-border hidden lg:block" />
               <div className="grid grid-cols-3 gap-6 text-center">
                 <div>
                   <div className="text-2xl font-bold text-green-600">
                     {images.reduce((acc, img) => acc + (img.pin_classification?.valid_pins || 0), 0)}
                   </div>
                   <div className="text-[10px] uppercase text-muted-foreground font-bold">Pins OK</div>
                 </div>
                 <div>
                   <div className="text-2xl font-bold text-red-600">
                     {images.reduce((acc, img) => acc + (img.pin_classification?.critical_pins || 0), 0)}
                   </div>
                   <div className="text-[10px] uppercase text-muted-foreground font-bold">Críticos</div>
                 </div>
                 <div>
                   <div className="text-2xl font-bold text-orange-600">
                     {images.reduce((acc, img) => acc + (img.boxes_info?.multiple_pins_boxes || 0), 0)}
                   </div>
                   <div className="text-[10px] uppercase text-muted-foreground font-bold">Extras</div>
                 </div>
               </div>
            </div>

            {/* Formulário de Aprovação/Rejeição */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-start">
               <div className="flex flex-col gap-2 w-full sm:w-[350px]">
                  <Input 
                    id="lote-name" 
                    placeholder="Nome do Lote" 
                    value={loteName}
                    onChange={(e) => setLoteName(e.target.value)}
                    className="h-9"
                  />
                  <Textarea 
                    placeholder="Descrição (opcional)"
                    value={loteDescription}
                    onChange={(e) => setLoteDescription(e.target.value)}
                    className="min-h-[40px] resize-y py-2 text-xs"
                    rows={1}
                  />
               </div>
               <div className="flex flex-col gap-2 w-full sm:w-auto">
                 <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-9"
                    onClick={handleAprovarLote}
                    disabled={isSaving}
                 >
                   {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                   Aprovar
                 </Button>
                 <Button 
                    variant="destructive"
                    className="w-full h-9"
                    onClick={handleRejeitarLote}
                    disabled={isSaving}
                 >
                   <XCircle className="mr-2 h-4 w-4" />
                   Rejeitar
                 </Button>
               </div>
            </div>

          </div>
        </Card>
      </main>
      
      <Footer />
    </div>
  )
}