"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"

interface UploadedFile {
  id: string
  file: File
  preview: string
}

export default function HawkEyePage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Estado do modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  // Funções de manipulação de arquivos
  // Ativa o estado de arrasto quando o usuário arrasta arquivos sobre a área de upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  // Desativa o estado de arrasto quando o usuário sai da área de upload
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  // Processa os arquivos soltos na área de upload
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
    processFiles(droppedFiles)
  }, [])

  // Processa os arquivos selecionados pelo input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((file) => file.type.startsWith("image/"))
    processFiles(selectedFiles)
  }, [])

  // Adiciona os arquivos recebidos ao estado
  const processFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
    }))
    setFiles((prev) => [...prev, ...uploadedFiles])
  }

  // Remove um arquivo específico do estado
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  // Remove todos os arquivos do estado
  const removeAllFiles = useCallback(() => {
    files.forEach((file) => URL.revokeObjectURL(file.preview))
    setFiles([])
  }, [files])

  // Lógica do modal
  // Abre o modal de visualização de imagem
  const openModal = (index: number) => {
    setSelectedImageIndex(index)
    setIsModalOpen(true)
  }

  // Fecha o modal de visualização de imagem
  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedImageIndex(null)
  }, [])

  // Mostra a próxima imagem no modal
  const showNextImage = useCallback(() => {
    if (files.length > 1) {
        setSelectedImageIndex((prevIndex) => (prevIndex! + 1) % files.length)
    }
  }, [files.length])

  // Mostra a imagem anterior no modal
  const showPrevImage = useCallback(() => {
    if (files.length > 1) {
        setSelectedImageIndex((prevIndex) => (prevIndex! - 1 + files.length) % files.length)
    }
  }, [files.length])

  // Exclui a imagem atual exibida no modal
  const handleDeleteFromModal = () => {
    if (selectedImageIndex !== null) {
      removeFile(files[selectedImageIndex].id)
    }
  }
  
  // Efeito para lidar com mudanças de índice após exclusão no modal
  // Atualiza o índice da imagem selecionada após exclusão ou mudança de arquivos
  useEffect(() => {
    if (isModalOpen) {
      if (files.length === 0) {
        closeModal()
      } else if (selectedImageIndex !== null && selectedImageIndex >= files.length) {
        setSelectedImageIndex(files.length - 1)
      }
    }
  }, [files, isModalOpen, selectedImageIndex, closeModal])

  // Efeito para navegação por teclado
  // Permite navegação por teclado no modal (setas e ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        showNextImage()
      } else if (e.key === "ArrowLeft") {
        showPrevImage()
      } else if (e.key === "Escape") {
        closeModal()
      }
    }

    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isModalOpen, showNextImage, showPrevImage, closeModal])


  // Alterna entre modo claro e escuro
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <div className={cn("min-h-screen flex flex-col", isDarkMode && "dark")}>
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

      <main className="flex-1 p-4 sm:p-8 flex items-center justify-center">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {files.length > 0 ? `Imagens Selecionadas (${files.length})` : "Upload de Imagens"}
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
                <p className="text-muted-foreground text-lg">ou clique para selecionar arquivos</p>
                <input id="file-input" type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
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
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                          <p className="text-xs font-medium text-white truncate">{file.file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
                 <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={() => document.getElementById("file-input-2")?.click()} className="border-dashed">
                      <Upload className="w-4 h-4 mr-2" />
                      Adicionar mais
                    </Button>
                     <input id="file-input-2" type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden"/>
                    <Button variant="ghost" onClick={removeAllFiles} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover todas
                    </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-6">
         <Button size="lg" className="w-full" disabled={files.length === 0}>
           Continuar
         </Button>
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
          <Button size="icon" variant="ghost" className="rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 md:bg-transparent md:text-foreground" onClick={showPrevImage} disabled={files.length <= 1}>
            <ChevronLeft className="w-10 h-10" />
          </Button>
        </div>
        <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center justify-center p-4">
          <img 
            src={files[selectedImageIndex].preview} 
            alt="Visualização" 
            className="max-w-full max-h-full object-contain rounded-lg select-none" 
          />
          <div className="absolute bottom-6">
            <Button variant="destructive" onClick={handleDeleteFromModal}>
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir imagem
            </Button>
          </div>
        </div>
        <div className="absolute right-4 z-10 md:relative md:right-0">
          <Button size="icon" variant="ghost" className="rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 md:bg-transparent md:text-foreground" onClick={showNextImage} disabled={files.length <= 1}>
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