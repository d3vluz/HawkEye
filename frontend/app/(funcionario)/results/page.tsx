"use client"

// Revisão do lote analisado: visão geral, conferência captura a captura com correções, e registrar ou reprovar o lote.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { DialogoDeConfirmacao } from "@/components/dialogo-de-confirmacao"
import { DialogoDeRegistro, type DadosDoRegistro } from "@/components/revisao/dialogo-de-registro"
import { ListaDeCapturas, type Filtro } from "@/components/revisao/lista-de-capturas"
import { PainelDeVerificacoes } from "@/components/revisao/painel-de-verificacoes"
import { TotaisDoLote } from "@/components/revisao/totais"
import { VisaoGeral } from "@/components/revisao/visao-geral"
import { Visualizador } from "@/components/revisao/visualizador"
import { Button } from "@/components/ui/button"
import { descartarLote, lerCriterios, minhasLinhas, registrarLote } from "@/lib/api"
import {
  camadaDoDefeito, contagensDetectadas, corrigir, defeitosDetectados, verificacoesReprovadas,
  type Correcoes,
} from "@/lib/defeitos"
import { useSetas } from "@/lib/use-setas"
import { cn } from "@/lib/utils"
import type { Camada, Criterios, Defeito, ItemDeCaptura, Linha, ResultadoDaAnalise } from "@/types"

const CHAVE_DAS_ANALISES = "processedImages"
const CHAVE_DAS_CORRECOES = "reviewOverrides"

function lerDaSessao<T>(chave: string): T | null {
  try {
    const valor = sessionStorage.getItem(chave)
    return valor ? (JSON.parse(valor) as T) : null
  } catch {
    return null
  }
}

function limparSessao() {
  sessionStorage.removeItem(CHAVE_DAS_ANALISES)
  sessionStorage.removeItem(CHAVE_DAS_CORRECOES)
}

export default function PaginaDeRevisao() {
  const router = useRouter()
  const [analises, setAnalises] = useState<ResultadoDaAnalise[] | null>(null)
  const [indice, setIndice] = useState(0)
  const [camada, setCamada] = useState<Camada>("original")
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [modo, setModo] = useState<"geral" | "capturas">("geral")
  const [correcoes, setCorrecoes] = useState<Record<string, Correcoes>>({})
  const [criterios, setCriterios] = useState<Criterios | null>(null)
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [dialogo, setDialogo] = useState<"registrar" | "reprovar" | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const salvas = lerDaSessao<ResultadoDaAnalise[]>(CHAVE_DAS_ANALISES)
    if (!salvas?.length) {
      router.replace("/inspecao")
      return
    }
    setAnalises(salvas)
    setCorrecoes(lerDaSessao<Record<string, Correcoes>>(CHAVE_DAS_CORRECOES) ?? {})
    lerCriterios().then(setCriterios).catch(() => setCriterios(null))
    minhasLinhas().then(setLinhas).catch(() => setLinhas([]))
  }, [router])

  useEffect(() => {
    if (analises) sessionStorage.setItem(CHAVE_DAS_CORRECOES, JSON.stringify(correcoes))
  }, [correcoes, analises])

  const revisoes = useMemo(() => (analises ?? []).map((analise) => {
    const detectados = defeitosDetectados(analise, criterios)
    const minhas = correcoes[analise.sha256]
    const finais = { ...detectados, ...minhas }
    const item: ItemDeCaptura = {
      chave: analise.sha256,
      nome: analise.filename,
      imagens: { original: analise.original_url, areas: analise.areas_url, pins: analise.pins_url, boxes: analise.boxes_url, shafts: analise.shafts_url },
      reprovacoes: verificacoesReprovadas(finais, criterios).map((v) => v.titulo),
      corrigida: Object.keys(minhas ?? {}).length > 0,
    }
    return { analise, detectados, minhas, finais, item }
  }), [analises, correcoes, criterios])

  const itens = revisoes.map((r) => r.item)
  const totais = {
    capturas: itens.length,
    aprovadas: itens.filter((i) => i.reprovacoes.length === 0).length,
    reprovadas: itens.filter((i) => i.reprovacoes.length > 0).length,
    corrigidas: itens.filter((i) => i.corrigida).length,
  }

  const irPara = useCallback((proximo: number) => setIndice(Math.max(0, Math.min(itens.length - 1, proximo))), [itens.length])
  useSetas(modo === "capturas" && !dialogo, indice, irPara)

  if (!analises) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const atual = revisoes[indice]

  const marcar = (defeito: Defeito, temDefeito: boolean) => {
    setCorrecoes((anteriores) => ({ ...anteriores, [atual.analise.sha256]: corrigir(anteriores[atual.analise.sha256], atual.detectados, defeito, temDefeito) }))
  }

  const desfazer = () => {
    setCorrecoes(({ [atual.analise.sha256]: _removidas, ...restantes }) => restantes)
  }

  const abrirCaptura = (i: number) => {
    setIndice(i)
    setModo("capturas")
  }

  const abrirDefeito = (defeito: Defeito) => {
    const primeira = revisoes.findIndex((r) => r.finais[defeito])
    if (primeira < 0) return
    setFiltro("todas")
    setCamada(camadaDoDefeito(defeito))
    abrirCaptura(primeira)
  }

  const executar = async (acao: () => Promise<unknown>, destino: string) => {
    setEnviando(true)
    setErro(null)
    try {
      await acao()
      limparSessao()
      router.push(destino)
    } catch (e) {
      setErro((e as Error).message)
      setEnviando(false)
    }
  }

  const registrar = ({ linhaId, nome, observacoes }: DadosDoRegistro) =>
    executar(() => registrarLote({
      name: nome,
      unit_id: linhaId,
      description: observacoes,
      batch_timestamp: analises[0].timestamp,
      captures: revisoes.map(({ analise, minhas, finais }) => ({
        filename: analise.filename,
        sha256: analise.sha256,
        areas_detected: analise.areas_count,
        grid_rows: analise.grid_rows,
        grid_cols: analise.grid_cols,
        detected_counts: contagensDetectadas(analise),
        has_missing_pins: finais.missing,
        has_extra_pins: finais.extra,
        has_damaged_pins: finais.damaged,
        has_wrong_color_pins: finais.wrongColor,
        has_shaft_defects: finais.shaft,
        structure_override: minhas?.structure,
      })),
    }), "/coletas")

  const reprovar = () => executar(() => descartarLote(analises[0].timestamp), "/inspecao")

  return (
    <div className={cn("flex min-h-dvh flex-col gap-4 p-4 sm:p-6", modo === "capturas" && "xl:h-dvh")}>
      <Cabecalho
        trilha={[{ rotulo: "Inspeção" }, { rotulo: "Novo lote" }]}
        titulo="Revisão do lote"
        descricao="Confira as capturas, corrija o que o sistema errou e registre ou reprove o lote."
        acoes={<TotaisDoLote totais={totais} />}
      />

      <div role="tablist" aria-label="Modo de revisão" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {([["geral", "Visão geral"], ["capturas", "Revisar capturas"]] as const).map(([chave, rotulo]) => (
          <button
            key={chave}
            role="tab"
            aria-selected={modo === chave}
            onClick={() => setModo(chave)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              modo === chave ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {modo === "geral" ? (
        <VisaoGeral itens={itens} defeitos={revisoes.map((r) => r.finais)} aoAbrir={abrirCaptura} aoEscolherDefeito={abrirDefeito} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col lg:row-span-2 lg:max-h-[calc(100dvh-14rem)] xl:row-span-1 xl:max-h-none">
            <ListaDeCapturas itens={itens} selecionada={indice} filtro={filtro} aoFiltrar={setFiltro} aoSelecionar={irPara} />
          </div>
          <Visualizador
            item={atual.item}
            indice={indice}
            total={itens.length}
            camada={camada}
            aoTrocarCamada={setCamada}
            aoVoltar={() => irPara(indice - 1)}
            aoAvancar={() => irPara(indice + 1)}
          />
          <PainelDeVerificacoes
            analise={atual.analise}
            defeitos={atual.finais}
            correcoes={atual.minhas}
            criterios={criterios}
            camada={camada}
            aoMarcar={marcar}
            aoDesfazer={desfazer}
            aoMostrar={setCamada}
          />
        </div>
      )}

      <footer className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-card">
        <p className="text-sm text-muted-foreground">
          {totais.reprovadas === 0
            ? "Todas as capturas foram aprovadas."
            : `${totais.reprovadas} de ${totais.capturas} capturas serão registradas como reprovadas.`}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" className="flex-1 text-danger-emphasis hover:text-danger-emphasis sm:flex-none" onClick={() => { setErro(null); setDialogo("reprovar") }}>
            Reprovar lote
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { setErro(null); setDialogo("registrar") }}>Registrar lote</Button>
        </div>
      </footer>

      {dialogo === "registrar" && (
        <DialogoDeRegistro linhas={linhas} totais={totais} enviando={enviando} erro={erro} aoRegistrar={registrar} aoCancelar={() => setDialogo(null)} />
      )}
      <DialogoDeConfirmacao
        aberto={dialogo === "reprovar"}
        titulo="Reprovar este lote?"
        descricao={`${totais.capturas === 1 ? "A imagem será apagada" : `As ${totais.capturas} imagens serão apagadas`} e nada será registrado. Use quando o lote inteiro precisar ser refeito.`}
        confirmar="Reprovar lote"
        confirmando="Reprovando..."
        enviando={enviando}
        erro={dialogo === "reprovar" ? erro : null}
        aoConfirmar={reprovar}
        aoCancelar={() => setDialogo(null)}
      />
    </div>
  )
}
