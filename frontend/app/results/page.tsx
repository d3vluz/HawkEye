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
import { Loader2, CheckCircle2, XCircle, Package, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { cn } from "@/lib/utils"

interface ProcessedImage {
  filename: string
  sha256: string
  timestamp: string
  original_url: string
  areas_url: string
  pins_url: string
  boxes_url: string
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
}

export default function ResultsPage() {
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [selectedView, setSelectedView] = useState<string>("boxes")
  const [loteName, setLoteName] = useState("")
  const [loteDescription, setLoteDescription] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const storedImages = sessionStorage.getItem("processedImages")
    
    if (!storedImages) {
      const usingGlobalMemory = sessionStorage.getItem("usingGlobalMemory")
      if (usingGlobalMemory === "true") {
        import("@/app/page").then((module) => {
          const globalImages = module.getGlobalProcessedImages()
          if (globalImages && globalImages.length > 0) {
            console.log("Carregando imagens da memória global:", globalImages.length)
            setImages(globalImages)
            setIsLoading(false)
          } else {
            router.replace("/")
          }
        }).catch(() => {
          router.replace("/")
        })
        return
      }
    }

    if (storedImages) {
      try {
        const parsedImages: ProcessedImage[] = JSON.parse(storedImages)
        console.log("Imagens carregadas do sessionStorage:", parsedImages.length)
        if (parsedImages.length > 0) {
          setImages(parsedImages)
        } else {
          router.replace("/")
        }
      } catch (error) {
        console.error("Erro ao parsear as imagens do sessionStorage:", error)
        router.replace("/")
      }
    } else {
      router.replace("/")
    }

    setIsLoading(false)
  }, [router])
  
  const selectedImage = images[selectedImageIndex]

  const handleAprovarLote = async () => {
    if (!loteName.trim()) {
      alert("Por favor, preencha o nome do lote")
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const loteData = {
        loteName,
        loteDescription,
        status: "aprovado",
        images: images.map(img => ({
          filename: img.filename,
          sha256: img.sha256,
          timestamp: img.timestamp,
          original_url: img.original_url,
          areas_url: img.areas_url,
          pins_url: img.pins_url,
          boxes_url: img.boxes_url,
          areas_count: img.areas_count,
          pins_count: img.pins_count,
          boxes_info: img.boxes_info
        })),
        totalImages: images.length,
        createdAt: new Date().toISOString()
      }

      console.log("Lote aprovado:", loteData)
      
      // @TODO: refatorar para o envio para API de cadastro do lote:
      // const response = await fetch(`${API_URL}/lotes/aprovar`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(loteData)
      // })

      setSaveSuccess(true)
      
      setTimeout(() => {
        sessionStorage.removeItem("processedImages")
        sessionStorage.removeItem("usingGlobalMemory")
        router.push("/")
      }, 2000)

    } catch (error) {
      console.error("Erro ao aprovar lote:", error)
      alert("Erro ao aprovar o lote. Tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejeitarLote = () => {
    if (confirm("Tem certeza que deseja rejeitar este lote? As imagens processadas serão descartadas.")) {
      sessionStorage.removeItem("processedImages")
      sessionStorage.removeItem("usingGlobalMemory")
      router.push("/")
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resultados do Processamento</CardTitle>
                <CardDescription>
                  Imagem {selectedImageIndex + 1} de {images.length}: {selectedImage.filename}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Select value={selectedView} onValueChange={setSelectedView}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a visualização" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Original</SelectItem>
                      <SelectItem value="areas">Áreas Detectadas</SelectItem>
                      <SelectItem value="pins">Pins Detectados</SelectItem>
                      <SelectItem value="boxes">Análise de Caixas</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <Image
                      src={
                        selectedView === "original" ? selectedImage.original_url :
                        selectedView === "areas" ? selectedImage.areas_url :
                        selectedView === "pins" ? selectedImage.pins_url :
                        selectedImage.boxes_url
                      }
                      alt={
                        selectedView === "original" ? "Imagem Original" :
                        selectedView === "areas" ? "Áreas Detectadas" :
                        selectedView === "pins" ? "Pins Detectados" :
                        "Análise de Caixas"
                      }
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>

                  {selectedView === "areas" && (
                    <p className="text-sm text-muted-foreground">
                      {selectedImage.areas_count} áreas detectadas
                    </p>
                  )}

                  {selectedView === "pins" && (
                    <p className="text-sm text-muted-foreground">
                      {selectedImage.pins_count} pins detectados
                    </p>
                  )}

                  {selectedView === "boxes" && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded">
                          <div className="text-2xl font-bold">{selectedImage.boxes_info?.total_boxes || 0}</div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
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
                    </>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex justify-between items-center pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                      disabled={selectedImageIndex === 0}
                    >
                      ← Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedImageIndex + 1} / {images.length}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedImageIndex(Math.min(images.length - 1, selectedImageIndex + 1))}
                      disabled={selectedImageIndex === images.length - 1}
                    >
                      Próxima →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedImage.boxes_info && selectedImage.boxes_info.empty_boxes > selectedImage.boxes_info.total_boxes * 0.3 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Atenção: Mais de 30% das caixas estão vazias nesta imagem.
                </AlertDescription>
              </Alert>
            )}

            {selectedImage.boxes_info && selectedImage.boxes_info.multiple_pins_boxes > 0 && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  {selectedImage.boxes_info.multiple_pins_boxes} caixa(s) com múltiplos pins detectada(s).
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="text-2xl font-bold">{images.length}</div>
                    <div className="text-xs text-muted-foreground">Imagens</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {images.reduce((sum, img) => sum + (img.boxes_info?.total_boxes || 0), 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Caixas Total</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="text-2xl font-bold">
                      {images.reduce((sum, img) => sum + img.pins_count, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Pins Total</div>
                  </div>
                  <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {images.reduce((sum, img) => sum + (img.boxes_info?.empty_boxes || 0), 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Vazias Total</div>
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