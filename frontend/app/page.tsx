"use client"

import React, { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Trash2, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, Plus, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"

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

// --- Constantes ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
const MAX_FILES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function HawkEyePage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>("")
  const [viewerOpen, setViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const router = useRouter()

  const validateFile = (file: File): string | null => {
    if (file.type !== "image/png") {
      return `${file.name}: Apenas arquivos PNG são permitidos.`
    }
    if (file.size > MAX_FILE_SIZE) return `${file.name} excede 10MB`
    return null
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const remainingSlots = MAX_FILES - files.length
    if (remainingSlots <= 0) {
      setError(`Limite de ${MAX_FILES} imagens atingido.`)
      return
    }

    const filesToAdd = newFiles.slice(0, remainingSlots)
    const validFiles: UploadedFile[] = []
    const errors: string[] = []
    
    filesToAdd.forEach((file) => {
      const err = validateFile(file)
      if (err) {
        errors.push(err)
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
      setError(null)
    }
  }, [files.length])

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }

      const newFiles = prev.filter(f => f.id !== id)
      if (newFiles.length === 0) {
        setViewerOpen(false)
        setCurrentImageIndex(0)
      } else if (currentImageIndex >= newFiles.length) {
        setCurrentImageIndex(newFiles.length - 1)
      }

      return newFiles
    })
  }

  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview))
    }
  }, [])

  // --- Drag and Drop ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
  }
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const openViewer = (index: number) => {
    setCurrentImageIndex(index)
    setViewerOpen(true)
  }

  const nextImage = useCallback(() => {
    if (files.length <= 1) return
    setCurrentImageIndex((prev) => (prev + 1) % files.length)
  }, [files.length])

  const prevImage = useCallback(() => {
    if (files.length <= 1) return
    setCurrentImageIndex((prev) => (prev - 1 + files.length) % files.length)
  }, [files.length])

  useEffect(() => {
    if (!viewerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextImage()
      if (e.key === "ArrowLeft") prevImage()
      if (e.key === "Escape") setViewerOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [viewerOpen, nextImage, prevImage])

  // --- Lógica de Upload ---
  const handleContinue = async () => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)
    setUploadProgress("Iniciando upload...")

    try {
      const formData = new FormData()
      files.forEach((f) => formData.append("files", f.file))

      const uploadRes = await fetch(`${API_URL}/upload-batch/`, {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) throw new Error("Falha no upload das imagens")
      const uploadData = await uploadRes.json()
      const uploadedFiles: UploadResponse[] = uploadData.files

      setUploadProgress("Processando ...")
      const processRes = await fetch(`${API_URL}/process-images/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: uploadedFiles.map(img => ({
            filename: img.filename,
            storage_path: img.storage_path,
            sha256: img.sha256,
            timestamp: img.timestamp
          }))
        }),
      })

      if (!processRes.ok) throw new Error("Falha no processamento das imagens")
      const processData = await processRes.json()

      sessionStorage.setItem("processedImages", JSON.stringify(processData.results))
      sessionStorage.removeItem("usingGlobalMemory")
      
      setUploadProgress("Concluído!")
      router.push("/results")

    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsLoading(false)
      setUploadProgress("")
    }
  }
  
  const currentFile = files[currentImageIndex]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <Card 
          className={cn(
            "w-full max-w-4xl transition-all duration-200 border-2",
            isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upload de Imagens</span>
              <span className="text-sm font-normal text-muted-foreground">
                {files.length} / {MAX_FILES}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Área Principal */}
            {files.length === 0 ? (
              <div 
                className="flex flex-col items-center justify-center py-16 cursor-pointer border-2 border-dashed border-muted-foreground/25 rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Arraste imagens ou clique aqui</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Apenas formato PNG (máx. 10MB)
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {files.map((file, index) => (
                  <div key={file.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted border shadow-sm">
                    <Image
                      src={file.preview}
                      alt="Preview"
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110 cursor-pointer"
                      onClick={() => openViewer(index)}
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                      <ImageIcon className="text-white w-6 h-6" />
                    </div>
                    
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(file.id)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                {files.length < MAX_FILES && (
                  <button
                    onClick={() => document.getElementById("file-input")?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center transition-all group"
                  >
                    <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-2" />
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">Adicionar</span>
                  </button>
                )}
              </div>
            )}

            {/* Input Escondido */}
            <input
              id="file-input"
              type="file"
              multiple
              accept="image/png"
              onChange={handleFileInput}
              className="hidden"
            />

            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-6 bg-muted/20">
            <Button 
              variant="ghost" 
              onClick={() => { setFiles([]); setError(null); }}
              disabled={files.length === 0 || isLoading}
            >
              Limpar tudo
            </Button>
            
            <Button 
              onClick={handleContinue}
              disabled={files.length === 0 || isLoading}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress}
                </>
              ) : (
                <>
                  Processar Lote
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>

      {/* --- Visualizador de Imagem --- */}
      {viewerOpen && currentFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50"
            onClick={() => setViewerOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navegação Esquerda */}
          {files.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-50 h-12 w-12 rounded-full bg-background/50 hover:bg-background/80"
              onClick={prevImage}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Área da Imagem */}
          <div className="relative w-full h-full max-w-6xl max-h-[85vh] p-4 flex flex-col items-center justify-center">
             <div className="relative w-full h-full">
                <Image
                  src={currentFile.preview}
                  alt="Visualização Ampliada"
                  fill
                  className="object-contain drop-shadow-2xl"
                  unoptimized
                />
             </div>
             
             {/* Barra de Ferramentas Flutuante */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-background/90 p-2 rounded-full border shadow-lg z-50">
                <span className="text-sm font-medium px-3">
                  {currentImageIndex + 1} de {files.length}
                </span>
                <div className="h-4 w-px bg-border" />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                  onClick={() => removeFile(currentFile.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
             </div>
          </div>

          {/* Navegação Direita */}
          {files.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-50 h-12 w-12 rounded-full bg-background/50 hover:bg-background/80"
              onClick={nextImage}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>
      )}

      <Footer />
    </div>
  )
}