"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import ReactBeforeSliderComponent from "react-before-after-slider-component"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { cn } from "@/lib/utils"

interface ComparisonImage {
  filename: string
  original_image_data: string
  processed_image_data: string
}

export default function ResultsPage() {
  const [images, setImages] = useState<ComparisonImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
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
        const parsedImages: ComparisonImage[] = JSON.parse(storedImages)
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
          original_image_data: img.original_image_data,
          processed_image_data: img.processed_image_data
        })),
        totalImages: images.length,
        createdAt: new Date().toISOString()
      }

      console.log("Lote aprovado:", loteData)
      
      // @TODO: refatorar para o envio da para API de cadastro do lote:
      // const response = await fetch(`${API_URL}/lotes/aprovar`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(loteData)
      // })

      setSaveSuccess(true)
      
      setTimeout(() => {
        sessionStorage.removeItem("processedImages")
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
      router.push("/")
    }
  }



  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna da Esquerda: Visualizador com Slider */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Análise de Imagem</CardTitle>
                <CardDescription>
                  Arraste o slider para comparar o antes e o depois.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full rounded-lg overflow-hidden border bg-muted">
                  <ReactBeforeSliderComponent
                    firstImage={{ imageUrl: selectedImage.original_image_data }}
                    secondImage={{ imageUrl: selectedImage.processed_image_data }}
                    withResizeFeel={true}
                  />
                </div>
                <p 
                  className="text-center text-sm text-muted-foreground mt-4 truncate px-4" 
                  title={selectedImage.filename}
                >
                  <strong>Arquivo:</strong> {selectedImage.filename}
                </p>
                <p className="text-center text-xs text-muted-foreground mt-1">
                  Imagem {selectedImageIndex + 1} de {images.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Coluna da Direita: Galeria e Formulário */}
          <div className="flex flex-col justify-between gap-8">

            {/* Seção da Galeria */}
            <Card>
              <CardHeader>
                <CardTitle>Imagens Processadas</CardTitle>
                <CardDescription>
                  {images.length} {images.length === 1 ? 'imagem' : 'imagens'} no lote
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 max-h-[400px] overflow-x-auto pr-2 scrollbar-thin">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className={cn(
                        "aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                        selectedImageIndex === index 
                          ? "border-primary shadow-lg ring-2 ring-primary/20" 
                          : "border-transparent hover:border-primary/50"
                      )}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <Image
                        src={image.processed_image_data}
                        alt={`Thumbnail de ${image.filename}`}
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Seção do Formulário */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Informações do Lote</CardTitle>
                <CardDescription>
                  Preencha os dados e aprove ou rejeite o lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-full flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote-name">
                      Nome do Lote <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="lote-name" 
                      placeholder="Ex: Lote 0001" 
                      value={loteName}
                      onChange={(e) => setLoteName(e.target.value)}
                      disabled={isSaving || saveSuccess}
                      required
                    />
                  </div>
                
                  <div className="space-y-2">
                    <Label htmlFor="lote-description">Descrição</Label>
                    <Textarea
                      id="lote-description"
                      placeholder="Adicione observações importantes sobre este lote."
                      value={loteDescription}
                      onChange={(e) => setLoteDescription(e.target.value)}
                      rows={8}
                      disabled={isSaving || saveSuccess}
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button 
                    onClick={handleAprovarLote} 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={isSaving || saveSuccess || !loteName.trim()}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isSaving ? "Aprovando..." : "Aprovar Lote"}
                  </Button>

                  <Button 
                    onClick={handleRejeitarLote} 
                    variant="destructive" 
                    className="w-full"
                    disabled={isSaving || saveSuccess}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar Lote
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}