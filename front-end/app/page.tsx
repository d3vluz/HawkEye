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

interface ProcessedImage {
  filename: string
  original_image_data: string
  processed_image_data: string
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

  const processFiles = useCallback((newFiles: File[]) => {
    const validFiles: UploadedFile[] = []
    const errors: string[] = []

    newFiles.forEach((file) => {
      const validationError = validateFile(file)
      if (validationError) {
        errors.push(validationError)
      } else {
        const isDuplicate = files.some(f => 
          f.file.name === file.name && 
          f.file.size === file.size &&
          f.file.type === file.type
        )
        if (!isDuplicate) {
          validFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview: URL.createObjectURL(file),
          })
        } else {
          errors.push(`${file.name} já foi adicionado`)
        }
      }
    })

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
    }

    if (errors.length > 0) {
      setError(errors.join("; "))
    } else {
      setError(null)
    }
  }, [files])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setError(null)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length + files.length > MAX_FILES) {
      setError(`Máximo de ${MAX_FILES} imagens permitidas. Você tentou adicionar ${droppedFiles.length} imagens, mas só há espaço para ${MAX_FILES - files.length}`)
      return
    }
    processFiles(droppedFiles)
  }, [files.length, processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length + files.length > MAX_FILES) {
      setError(`Máximo de ${MAX_FILES} imagens permitidas. Você tentou adicionar ${selectedFiles.length} imagens, mas só há espaço para ${MAX_FILES - files.length}`)
      e.target.value = ""
      return
    }
    processFiles(selectedFiles)
    e.target.value = ""
  }, [files.length, processFiles])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
    setError(null)
  }, [])

  const removeAllFiles = useCallback(() => {
    if (confirm(`Deseja remover todas as ${files.length} imagens?`)) {
      files.forEach((file) => URL.revokeObjectURL(file.preview))
      setFiles([])
      setError(null)
    }
  }, [files])

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

  const processBatch = async (batch: UploadedFile[]) => {
    const formData = new FormData()
    
    batch.forEach((uploadedFile) => {
      formData.append("files", uploadedFile.file)
    })

    const response = await fetch(`${API_URL}/process-images/`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = "Falha ao processar as imagens. Tente novamente."
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorMessage
      } catch {
        errorMessage = `Erro ${response.status}: ${response.statusText}`
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.processed_images
  }

  const handleContinue = async () => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)
    setUploadProgress("Iniciando processamento...")

    try {
      const BATCH_SIZE = 10
      const batches: UploadedFile[][] = []
      
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE))
      }

      console.log(`Processando ${files.length} imagens em ${batches.length} lote(s)...`)

      globalProcessedImages = []

      for (let i = 0; i < batches.length; i++) {
        setUploadProgress(`Processando lote ${i + 1} de ${batches.length}...`)
        
  const batchResults = await processBatch(batches[i])
        
        if (!batchResults || !Array.isArray(batchResults)) {
          throw new Error("Resposta da API em formato inválido")
        }

        const invalidImages = batchResults.filter(
          (img: ProcessedImage) => !img.original_image_data || !img.processed_image_data
        )
        
        if (invalidImages.length > 0) {
          throw new Error(`${invalidImages.length} imagem(ns) não processada(s) corretamente`)
        }

        globalProcessedImages = [...globalProcessedImages, ...batchResults]
        
        console.log(`Lote ${i + 1}/${batches.length} processado: ${batchResults.length} imagens`)
      }

      console.log(`Total de ${globalProcessedImages.length} imagens processadas com sucesso`)

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
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                  {files.map((file, index) => (
                    <div
                      key={file.id}
                      className="group relative aspect-square overflow-hidden rounded-lg cursor-pointer"
                      onClick={() => openModal(index)}
                    >
                      <Image
                        src={file.preview}
                        alt={file.file.name}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                        className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        aria-label="Remover imagem"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-xs font-medium text-white truncate">{file.file.name}</p>
                        <p className="text-xs text-white/70">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById("file-input-2")?.click()} 
                    className="border-dashed"
                    disabled={files.length >= MAX_FILES || isLoading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Adicionar mais {files.length >= MAX_FILES && `(${MAX_FILES}/${MAX_FILES})`}
                  </Button>
                  <input 
                    id="file-input-2" 
                    type="file" 
                    multiple 
                    accept="image/jpeg,image/jpg,image/png,image/webp" 
                    onChange={handleFileSelect} 
                    className="hidden"
                  />
                  <Button 
                    variant="ghost" 
                    onClick={removeAllFiles} 
                    className="text-destructive hover:text-destructive"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover todas
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-6 flex flex-col items-stretch gap-4">
            <Button
              size="lg"
              className="w-full"
              disabled={files.length === 0 || isLoading}
              onClick={handleContinue}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading 
                ? uploadProgress || "Processando..." 
                : `Continuar com ${files.length} ${files.length === 1 ? 'imagem' : 'imagens'}`
              }
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isLoading && (
              <p className="text-sm text-center text-muted-foreground">
                Isso pode levar alguns minutos para muitas imagens...
              </p>
            )}
          </CardFooter>
        </Card>
      </main>

      {isModalOpen && selectedImageIndex !== null && files[selectedImageIndex] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div className="relative w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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