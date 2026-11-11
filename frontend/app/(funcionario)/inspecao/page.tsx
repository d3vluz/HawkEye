"use client"

// Início da inspeção: o funcionário escolhe as capturas (PNG), envia e analisa; o resultado segue para a revisão.

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronLeft, ChevronRight, Image as IconeDeImagem, Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { analisarImagens, enviarImagens } from "@/lib/api"
import { cn } from "@/lib/utils"

const MAXIMO_DE_ARQUIVOS = 10
const TAMANHO_MAXIMO = 10 * 1024 * 1024

interface Arquivo {
  id: string
  arquivo: File
  previa: string
}

function problemaDoArquivo(arquivo: File) {
  if (arquivo.type !== "image/png") return `${arquivo.name}: apenas arquivos PNG são permitidos.`
  if (arquivo.size > TAMANHO_MAXIMO) return `${arquivo.name} excede 10 MB.`
  return null
}

export default function PaginaDeInspecao() {
  const router = useRouter()
  const seletor = useRef<HTMLInputElement>(null)
  const [arquivos, setArquivos] = useState<Arquivo[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<number | null>(null)

  const adicionar = (novos: File[]) => {
    const vagas = MAXIMO_DE_ARQUIVOS - arquivos.length
    if (vagas <= 0) return setErro(`Limite de ${MAXIMO_DE_ARQUIVOS} imagens atingido.`)
    const escolhidos = novos.slice(0, vagas)
    const problemas = escolhidos.map(problemaDoArquivo).filter((p): p is string => p !== null)
    const validos = escolhidos
      .filter((arquivo) => !problemaDoArquivo(arquivo))
      .map((arquivo) => ({ id: crypto.randomUUID(), arquivo, previa: URL.createObjectURL(arquivo) }))
    setErro(problemas.length ? problemas.join("\n") : null)
    if (validos.length) setArquivos((atuais) => [...atuais, ...validos])
  }

  const remover = (id: string) => {
    const restantes = arquivos.filter((a) => a.id !== id)
    URL.revokeObjectURL(arquivos.find((a) => a.id === id)!.previa)
    setArquivos(restantes)
    setAmpliada((atual) => (atual === null || restantes.length === 0 ? null : Math.min(atual, restantes.length - 1)))
  }

  const limpar = () => {
    arquivos.forEach((a) => URL.revokeObjectURL(a.previa))
    setArquivos([])
    setErro(null)
  }

  const navegar = useCallback(
    (passo: number) => setAmpliada((atual) => (atual === null ? null : (atual + passo + arquivos.length) % arquivos.length)),
    [arquivos.length]
  )

  useEffect(() => {
    if (ampliada === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "ArrowRight") navegar(1)
      if (evento.key === "ArrowLeft") navegar(-1)
      if (evento.key === "Escape") setAmpliada(null)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [ampliada, navegar])

  const processar = async () => {
    setErro(null)
    try {
      setEtapa("Enviando…")
      const { files } = await enviarImagens(arquivos.map((a) => a.arquivo))
      setEtapa("Processando…")
      const { results } = await analisarImagens(files)
      sessionStorage.setItem("processedImages", JSON.stringify(results))
      sessionStorage.removeItem("reviewOverrides")
      router.push("/results")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.")
      setEtapa(null)
    }
  }

  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault()
    setArrastando(false)
    adicionar(Array.from(evento.dataTransfer.files))
  }

  const atual = ampliada === null ? null : arquivos[ampliada]
  const ocupado = etapa !== null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <Card
          className={cn("w-full max-w-4xl border-2 transition-all duration-200", arrastando ? "scale-[1.01] border-primary bg-primary/5" : "border-border")}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={(e) => { e.preventDefault(); setArrastando(false) }}
          onDrop={aoSoltar}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upload de imagens</span>
              <span className="text-sm font-normal text-muted-foreground">{arquivos.length} / {MAXIMO_DE_ARQUIVOS}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {arquivos.length === 0 ? (
              <button
                type="button"
                onClick={() => seletor.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-16 transition-colors hover:bg-muted/50"
              >
                <span className="mb-4 rounded-full bg-primary/10 p-4">
                  <Upload className="size-8 text-primary" />
                </span>
                <span className="text-lg font-semibold">Arraste imagens ou clique aqui</span>
                <span className="mt-1 text-sm text-muted-foreground">Apenas PNG (máx. 10 MB)</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {arquivos.map((a, indice) => (
                  <div key={a.id} className="group relative aspect-square overflow-hidden rounded-2xl border bg-muted shadow-sm transition-all hover:shadow-md">
                    <Image
                      src={a.previa}
                      alt={a.arquivo.name}
                      fill
                      unoptimized
                      className="cursor-pointer object-cover transition-transform duration-500 group-hover:scale-110"
                      onClick={() => setAmpliada(indice)}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <IconeDeImagem className="size-8 text-white drop-shadow-md" />
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      aria-label={`Remover ${a.arquivo.name}`}
                      className="absolute top-1 right-1 size-7 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => remover(a.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}

                {arquivos.length < MAXIMO_DE_ARQUIVOS && (
                  <button
                    type="button"
                    onClick={() => seletor.current?.click()}
                    className="group flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-all hover:border-primary hover:bg-primary/5"
                  >
                    <Plus className="mb-2 size-8 text-muted-foreground group-hover:text-primary" />
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">Adicionar</span>
                  </button>
                )}
              </div>
            )}

            <input
              ref={seletor}
              type="file"
              multiple
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                adicionar(Array.from(e.target.files ?? []))
                e.target.value = ""
              }}
            />

            {erro && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="whitespace-pre-line">{erro}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t bg-muted/20 pt-6">
            <Button variant="ghost" onClick={limpar} disabled={arquivos.length === 0 || ocupado}>
              Limpar tudo
            </Button>
            <Button onClick={processar} disabled={arquivos.length === 0 || ocupado} className="min-w-[140px]">
              {ocupado ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {etapa}
                </>
              ) : (
                <>
                  Processar lote
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>

      {atual && ampliada !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            className="absolute top-4 right-4 z-50 rounded-full text-white/70 hover:bg-white/20 hover:text-white"
            onClick={() => setAmpliada(null)}
          >
            <X className="size-6" />
          </Button>

          <div className="relative flex size-full max-h-screen max-w-7xl flex-col items-center justify-center p-4 sm:max-h-[90vh]">
            <div className="relative flex size-full items-center justify-center">
              <Image key={atual.id} src={atual.previa} alt={atual.arquivo.name} fill unoptimized className="object-contain drop-shadow-2xl" />
            </div>

            <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-background/90 p-3 px-6 shadow-2xl backdrop-blur-xl sm:bottom-10">
              {arquivos.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Anterior" className="size-10 rounded-full sm:size-12" onClick={() => navegar(-1)}>
                  <ChevronLeft className="size-6" />
                </Button>
              )}
              <span className="min-w-[60px] px-2 text-center text-sm font-semibold">{ampliada + 1} / {arquivos.length}</span>
              {arquivos.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Próxima" className="size-10 rounded-full sm:size-12" onClick={() => navegar(1)}>
                  <ChevronRight className="size-6" />
                </Button>
              )}
              <div className="mx-1 h-6 w-px bg-border" />
              <Button variant="destructive" size="icon" aria-label="Remover imagem" className="size-10 rounded-full shadow-md sm:size-12" onClick={() => remover(atual.id)}>
                <Trash2 className="size-4 sm:size-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
