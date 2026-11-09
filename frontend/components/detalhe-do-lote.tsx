"use client"

// Detalhe de um lote registrado: resultado frente à meta, defeitos por tipo e inspeção captura a captura.
// Usado pelo admin (Lotes) e pelo funcionário (Minhas coletas), cada um com sua fonte de dados.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Download, Loader2, XCircle } from "lucide-react"
import { Cabecalho, type Etapa } from "@/components/cabecalho"
import { ListaDeCapturas, type Filtro } from "@/components/revisao/lista-de-capturas"
import { TotaisDoLote } from "@/components/revisao/totais"
import { DefeitosNoLote } from "@/components/revisao/visao-geral"
import { Visualizador } from "@/components/revisao/visualizador"
import { Button } from "@/components/ui/button"
import { lerCriterios } from "@/lib/api"
import { VERIFICACOES, camadaDoDefeito } from "@/lib/defeitos"
import { dataEHora, percentual } from "@/lib/formato"
import { useSetas } from "@/lib/use-setas"
import { cn } from "@/lib/utils"
import type { Camada, Captura, Defeito, ItemDeCaptura, LoteComCapturas } from "@/types"

function paraItem(captura: Captura): ItemDeCaptura {
  const original = captura.original_uri
  return {
    chave: captura.id,
    nome: captura.filename,
    imagens: {
      original,
      areas: captura.processed_areas_uri ?? original,
      pins: captura.processed_pins_uri ?? original,
      boxes: captura.processed_uri ?? original,
      shafts: captura.processed_shaft_uri ?? original,
    },
    reprovacoes: captura.is_valid ? [] : VERIFICACOES.filter((v) => captura.defects[v.defeito]).map((v) => v.titulo),
    corrigida: Boolean(captura.corrections?.length),
  }
}

function ResultadoDaCaptura({ captura, camada, aoMostrar }: { captura: Captura; camada: Camada; aoMostrar: (camada: Camada) => void }) {
  const encontrados = VERIFICACOES.filter((v) => captura.defects[v.defeito])
  const correcoes = new Map((captura.corrections ?? []).map((c) => [c.defect, c]))

  return (
    <section aria-label="Resultado da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          {captura.is_valid ? <CheckCircle2 className="size-5 text-success-emphasis" /> : <XCircle className="size-5 text-danger-emphasis" />}
          <h2 className="text-base font-semibold text-foreground">{captura.is_valid ? "Captura aprovada" : "Captura reprovada"}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {encontrados.length > 0
            ? `${captura.is_valid ? "Tolerado pelos critérios" : "Motivo"}: ${encontrados.map((v) => v.titulo.toLowerCase()).join(", ")}.`
            : "Nenhum defeito registrado."}
        </p>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-2 py-1">
        {VERIFICACOES.map((v) => {
          const temDefeito = captura.defects[v.defeito]
          const correcao = correcoes.get(v.defeito)
          return (
            <li key={v.defeito} className="py-1">
              <button
                onClick={() => aoMostrar(v.camada)}
                title="Mostrar a camada correspondente"
                className={cn("flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50", camada === v.camada && "bg-muted/50")}
              >
                <span className="mt-0.5">
                  {temDefeito ? <CircleAlert className="size-4 text-danger-emphasis" /> : <CheckCircle2 className="size-4 text-success-emphasis" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{v.titulo}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{temDefeito ? "Defeito registrado" : v.semDefeito}</span>
                  {correcao && (
                    <span className="block text-xs leading-relaxed text-primary-emphasis">
                      Corrigido na revisão: o sistema indicou {correcao.detected ? "defeito" : "OK"} e o operador marcou {correcao.corrected ? "defeito" : "OK"}.
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

async function baixarImagens(nomeDoLote: string, capturas: Captura[]) {
  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  for (const captura of capturas) {
    const pasta = zip.folder(captura.filename.replace(/\.[^.]+$/, "") || captura.id)
    if (!pasta) continue
    const arquivos = [
      [captura.original_uri, "original"],
      [captura.processed_areas_uri, "grade"],
      [captura.processed_pins_uri, "pinos"],
      [captura.processed_uri, "compartimentos"],
      [captura.processed_shaft_uri, "hastes"],
    ] as const
    for (const [url, nome] of arquivos) {
      if (!url) continue
      const resposta = await fetch(url).catch(() => null)
      if (resposta?.ok) pasta.file(`${nome}.png`, await resposta.blob())
    }
  }
  const link = document.createElement("a")
  link.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }))
  link.download = `${nomeDoLote.replace(/\s+/g, "_")}.zip`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function DetalheDoLote({ id, carregar, trilha }: {
  id: string
  carregar: (id: string) => Promise<LoteComCapturas>
  trilha: Etapa[]
}) {
  const [dados, setDados] = useState<LoteComCapturas | null>(null)
  const [meta, setMeta] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [indice, setIndice] = useState(0)
  const [camada, setCamada] = useState<Camada>("original")
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [baixando, setBaixando] = useState(false)
  const [erroNoDownload, setErroNoDownload] = useState<string | null>(null)

  useEffect(() => {
    carregar(id).then(setDados).catch((e: Error) => setErro(e.message))
    lerCriterios().then((c) => setMeta(c.minQualityScore)).catch(() => setMeta(null))
  }, [id, carregar])

  const capturas = useMemo(() => dados?.captures ?? [], [dados])
  const itens = useMemo(() => capturas.map(paraItem), [capturas])
  const irPara = useCallback((proximo: number) => setIndice(Math.max(0, Math.min(capturas.length - 1, proximo))), [capturas.length])
  useSetas(capturas.length > 0, indice, irPara)

  const voltar = trilha[trilha.length - 1]

  if (erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-8 text-danger-emphasis" />
        <p className="font-medium text-foreground">Não foi possível abrir o lote</p>
        <p className="text-sm text-muted-foreground">{erro}</p>
        {voltar?.href && <Button variant="outline" asChild><Link href={voltar.href}><ArrowLeft /> Voltar para {voltar.rotulo.toLowerCase()}</Link></Button>}
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const lote = dados.batch
  const abaixoDaMeta = meta !== null && lote.quality_score < meta

  const abrirDefeito = (defeito: Defeito) => {
    const primeira = capturas.findIndex((c) => c.defects[defeito])
    if (primeira < 0) return
    setFiltro("todas")
    setCamada(camadaDoDefeito(defeito))
    setIndice(primeira)
    document.getElementById("capturas-do-lote")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const baixar = async () => {
    setBaixando(true)
    setErroNoDownload(null)
    try {
      await baixarImagens(lote.name, capturas)
    } catch {
      setErroNoDownload("Não foi possível baixar as imagens. Tente novamente.")
    } finally {
      setBaixando(false)
    }
  }

  const detalhes = [
    lote.unit?.name,
    lote.author && `Coletado por ${lote.author.name ?? "membro removido"} · matrícula ${lote.author.matricula}`,
    dataEHora(lote.created_at),
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Cabecalho
        trilha={[...trilha, { rotulo: "Detalhes" }]}
        titulo={lote.name}
        descricao={
          <>
            <p>{detalhes.join(" · ")}</p>
            {lote.description && <p className="mt-2 max-w-2xl text-foreground">{lote.description}</p>}
          </>
        }
        acoes={
          <>
            <Button variant="outline" onClick={baixar} disabled={baixando || capturas.length === 0}>
              {baixando ? <Loader2 className="animate-spin" /> : <Download />}
              {baixando ? "Baixando..." : "Baixar imagens"}
            </Button>
            {erroNoDownload && <p role="alert" className="text-xs text-danger-emphasis">{erroNoDownload}</p>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Resultado do lote" className="flex flex-col rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Resultado do lote</h2>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-bold tracking-tight tabular-nums text-foreground">{percentual(lote.quality_score)}</p>
              <p className="mt-1 text-sm text-muted-foreground">das capturas aprovadas</p>
            </div>
            {meta !== null && (
              <p className={cn("text-right text-sm", abaixoDaMeta ? "text-danger-emphasis" : "text-success-emphasis")}>
                {abaixoDaMeta ? "Abaixo" : "Dentro"} da meta de {meta}%
              </p>
            )}
          </div>
          <div className="relative mt-3 h-2 rounded-full bg-muted">
            <div className={cn("h-full rounded-full", abaixoDaMeta ? "bg-danger" : "bg-success")} style={{ width: `${Math.min(lote.quality_score, 100)}%` }} />
            {meta !== null && <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60" style={{ left: `${meta}%` }} title={`Meta: ${meta}%`} />}
          </div>
          <TotaisDoLote
            className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4"
            totais={{
              capturas: lote.total_captures,
              aprovadas: lote.valid_captures,
              reprovadas: lote.invalid_captures,
              corrigidas: itens.filter((i) => i.corrigida).length,
            }}
          />
        </section>
        <DefeitosNoLote defeitos={capturas.map((c) => c.defects)} aoEscolher={abrirDefeito} duasColunas />
      </div>

      {capturas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Este lote não tem capturas.</p>
      ) : (
        <section id="capturas-do-lote" aria-label="Capturas do lote" className="scroll-mt-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Capturas</h2>
          <div className="grid grid-cols-1 gap-4 lg:h-[min(760px,calc(100dvh-4rem))] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <div className="flex min-h-0 flex-col">
              <ListaDeCapturas itens={itens} selecionada={indice} filtro={filtro} aoFiltrar={setFiltro} aoSelecionar={irPara} />
            </div>
            <Visualizador
              item={itens[indice]}
              indice={indice}
              total={itens.length}
              camada={camada}
              aoTrocarCamada={setCamada}
              aoVoltar={() => irPara(indice - 1)}
              aoAvancar={() => irPara(indice + 1)}
            />
            <div className="min-h-0 lg:col-span-2 xl:col-span-1">
              <ResultadoDaCaptura captura={capturas[indice]} camada={camada} aoMostrar={setCamada} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
