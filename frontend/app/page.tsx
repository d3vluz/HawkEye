"use client"

import type React from "react"
import Image from "next/image"
import { useState, useCallback, useEffect} from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Trash2, ChevronLeft, ChevronRight, Loader2, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UploadedFile {
  id: string
  file: File
  preview: string
}

interface UploadResponse {
  filename: string
  storage_path: string
  sha256: string
  timestamp: string
}

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

let globalProcessedImages: ProcessedImage[] = []

export default function HawkEyePage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>("")

  const router = useRouter()

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return `${file.name} não é uma imagem válida`
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} excede o tamanho máximo de 10MB`
    }
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return `${file.name} tem formato não suportado. Use JPEG, PNG ou WEBP`
    }
    
    return null
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const remainingSlots = MAX_FILES - files.length
    const filesToAdd = newFiles.slice(0, remainingSlots)
    
    const validFiles: UploadedFile[] = []
    const errors: string[] = []
    
    filesToAdd.forEach((file) => {
      const error = validateFile(file)
      if (error) {
        errors.push(error)
      } else {
        validFiles.push({
          id: Math.random().toString(36).substring(7),
          file,
          preview: URL.createObjectURL(file)
        })
      }
    })
    
    if (errors.length > 0) {
      setError(errors.join('\n'))
      setTimeout(() => setError(null), 5000)
    }
    
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
    }
    
    if (newFiles.length > remainingSlots) {
      setError(`Apenas ${remainingSlots} imagens foram adicionadas. Limite de ${MAX_FILES} imagens atingido.`)
      setTimeout(() => setError(null), 5000)
    }
  }, [files.length])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id)
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return updated
    })
  }

  const openModal = (index: number) => {
    setSelectedImageIndex(index)
    setIsModalOpen(true)
  }

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedImageIndex(null)
  }, [])

  const showNextImage = useCallback(() => {
    if (files.length > 1) {
      setSelectedImageIndex((prevIndex) => (prevIndex! + 1) % files.length)
    }
  }, [files.length])

  const showPrevImage = useCallback(() => {
    if (files.length > 1) {
      setSelectedImageIndex((prevIndex) => (prevIndex! - 1 + files.length) % files.length)
    }
  }, [files.length])

  const handleDeleteFromModal = () => {
    if (selectedImageIndex !== null) {
      removeFile(files[selectedImageIndex].id)
    }
  }

  useEffect(() => {
    if (isModalOpen) {
      if (files.length === 0) {
        closeModal()
      } else if (selectedImageIndex !== null && selectedImageIndex >= files.length) {
        setSelectedImageIndex(files.length - 1)
      }
    }
  }, [files, isModalOpen, selectedImageIndex, closeModal])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return
      if (e.key === "ArrowRight") showNextImage()
      else if (e.key === "ArrowLeft") showPrevImage()
      else if (e.key === "Escape") closeModal()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isModalOpen, showNextImage, showPrevImage, closeModal])

  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview))
    }
  }, [files])

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  const uploadBatch = async (files: File[]): Promise<UploadResponse[]> => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append("files", file)
    })

    const response = await fetch(`${API_URL}/upload-batch/`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.files
  }

  const processImages = async (uploadedImages: UploadResponse[]): Promise<ProcessedImage[]> => {
    const response = await fetch(`${API_URL}/process-images/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: uploadedImages.map(img => ({
          filename: img.filename,
          storage_path: img.storage_path,
          sha256: img.sha256,
          timestamp: img.timestamp
        }))
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.results
  }

  const handleContinue = async () => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)
    setUploadProgress("Iniciando upload do lote...")

    try {
      // 1. Upload de todas as imagens em um único lote
      const uploadResults = await uploadBatch(files.map(f => f.file))
      console.log(`✅ ${uploadResults.length} imagens enviadas para o Supabase com timestamp único`)
      console.log(`📅 Timestamp do lote: ${uploadResults[0]?.timestamp}`)

      // 2. Processar imagens
      setUploadProgress("Processando imagens...")
      
      const processedResults = await processImages(uploadResults)
      
      if (!processedResults || !Array.isArray(processedResults)) {
        throw new Error("Resposta da API em formato inválido")
      }

      globalProcessedImages = processedResults
      
      console.log(`✅ Total de ${globalProcessedImages.length} imagens processadas com sucesso`)

      // 3. Salvar no sessionStorage
      try {
        sessionStorage.setItem("processedImages", JSON.stringify(globalProcessedImages))
        console.log("Dados salvos no sessionStorage")
      } catch {
        console.warn("Não foi possível salvar no sessionStorage (dados muito grandes), usando memória global")
        sessionStorage.setItem("usingGlobalMemory", "true")
      }
      
      setUploadProgress("Concluído!")
      
      setTimeout(() => {
        router.push("/results")
      }, 500)

    } catch (err) {
      console.error("Erro ao processar imagens:", err)
      
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Não foi possível conectar ao servidor. Verifique se a API está rodando em " + API_URL)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Ocorreu um erro desconhecido.")
      }
    } finally {
      setIsLoading(false)
      setUploadProgress("")
    }
  }

  return (
    <div className={cn("min-h-screen flex flex-col", isDarkMode && "dark")}>
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

      <main className="flex-1 p-4 sm:p-8 flex items-center justify-center">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {files.length > 0 ? `Imagens Selecionadas (${files.length}/${MAX_FILES})` : "Upload de Imagens"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div
                className={cn(
                  "border-2 border-dashed border-border rounded-lg p-16 text-center transition-all duration-200 cursor-pointer hover:border-primary/50",
                  isDragOver && "border-primary bg-primary/10",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
                <h2 className="text-2xl font-semibold text-foreground mb-2">Arraste e solte suas imagens aqui</h2>
                <p className="text-muted-foreground text-lg mb-2">ou clique para selecionar arquivos</p>
                <p className="text-sm text-muted-foreground mb-1">Máximo de {MAX_FILES} imagens</p>
                <p className="text-xs text-muted-foreground">Formatos aceitos: JPEG, PNG, WEBP (máx. 10MB cada)</p>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {files.map((file, index) => (
                    <div key={file.id} className="relative group">
                      <div 
                        className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                        onClick={() => openModal(index)}
                      >
                        <Image
                          src={file.preview}
                          alt={file.file.name}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          unoptimized
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground truncate">{file.file.name}</p>
                    </div>
                  ))}
                  
                  {files.length < MAX_FILES && (
                    <div
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => document.getElementById("file-input")?.click()}
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <input
                        id="file-input"
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
          
          {files.length > 0 && (
            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={() => {
                  files.forEach((file) => URL.revokeObjectURL(file.preview))
                  setFiles([])
                }}
                disabled={isLoading}
              >
                Limpar Tudo
              </Button>
              <Button 
                className="w-full sm:flex-1" 
                onClick={handleContinue}
                disabled={isLoading || files.length === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadProgress || "Processando..."}
                  </>
                ) : (
                  "Continuar"
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      </main>

      {isModalOpen && selectedImageIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeModal}
          >
            <X className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center justify-between w-full max-w-7xl gap-4">
            <div className="absolute left-4 z-10 md:relative md:left-0">
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 md:bg-transparent md:text-foreground" 
                onClick={showPrevImage} 
                disabled={files.length <= 1}
              >
                <ChevronLeft className="w-10 h-10" />
              </Button>
            </div>
            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center justify-center p-4">
              <Image
                src={files[selectedImageIndex].preview}
                alt="Visualização"
                width={800}
                height={800}
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                unoptimized
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <Button 
                  size="sm"
                  variant="secondary"
                  className="bg-black/50 text-white hover:bg-black/70"
                >
                  {selectedImageIndex + 1} / {files.length}
                </Button>
              </div>
              <div className="absolute bottom-6 flex gap-2">
                <Button variant="destructive" onClick={handleDeleteFromModal}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir imagem
                </Button>
                <Button variant="secondary" onClick={closeModal}>
                  Fechar
                </Button>
              </div>
            </div>
            <div className="absolute right-4 z-10 md:relative md:right-0">
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 md:bg-transparent md:text-foreground" 
                onClick={showNextImage} 
                disabled={files.length <= 1}
              >
                <ChevronRight className="w-10 h-10" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export function getGlobalProcessedImages() {
  return globalProcessedImages
}