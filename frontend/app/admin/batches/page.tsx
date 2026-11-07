"use client"

// Todos os lotes registrados, com filtro por linha e exclusão.

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { DialogoDeConfirmacao } from "@/components/dialogo-de-confirmacao"
import { TabelaDeLotes } from "@/components/tabela-de-lotes"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apagarLote, lerCriterios, listarLinhas, listarLotes } from "@/lib/api"
import type { Linha, Lote } from "@/types"

const TODAS = "todas"

export default function PaginaDeLotes() {
  const [lotes, setLotes] = useState<Lote[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [linha, setLinha] = useState(TODAS)
  const [meta, setMeta] = useState<number | null>(null)
  const [excluindo, setExcluindo] = useState<Lote | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null)

  useEffect(() => {
    listarLinhas().then(setLinhas).catch(() => setLinhas([]))
    lerCriterios().then((c) => setMeta(c.minQualityScore)).catch(() => setMeta(null))
  }, [])

  useEffect(() => {
    listarLotes(linha === TODAS ? undefined : linha)
      .then((lista) => { setLotes(lista); setErro(null) })
      .catch((e: Error) => { setErro(e.message); setLotes((atuais) => atuais ?? []) })
  }, [linha])

  const excluir = async () => {
    if (!excluindo) return
    setEnviando(true)
    try {
      await apagarLote(excluindo.id)
      setLotes((atuais) => atuais?.filter((l) => l.id !== excluindo.id) ?? null)
      setExcluindo(null)
    } catch {
      setErroAoExcluir("Não foi possível excluir o lote. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  if (!lotes) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-12 animate-spin text-signal" aria-label="Carregando lotes" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <Cabecalho
        trilha={[{ rotulo: "Admin", href: "/admin" }, { rotulo: "Lotes" }]}
        titulo="Lotes"
        descricao="Consulte e gerencie os lotes registrados pelas linhas."
      />

      {erro && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger-emphasis">
          <p className="font-medium">Erro ao carregar os lotes</p>
          <p className="text-sm">{erro}</p>
        </div>
      )}

      <TabelaDeLotes
        titulo="Todos os lotes"
        lotes={lotes}
        endereco={(lote) => `/admin/batches/${lote.id}`}
        meta={meta}
        mostrarAutor
        aoExcluir={(lote) => { setErroAoExcluir(null); setExcluindo(lote) }}
        filtros={
          <Select value={linha} onValueChange={setLinha}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filtrar por linha">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as linhas</SelectItem>
              {linhas.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        vazio={{
          titulo: "Nenhum lote encontrado",
          texto: linha !== TODAS ? "Nenhum lote registrado nesta linha." : "Os lotes aparecem aqui depois de registrados na revisão.",
        }}
      />

      <DialogoDeConfirmacao
        aberto={excluindo !== null}
        titulo={`Excluir o lote ${excluindo?.name ?? ""}?`}
        descricao="As imagens são apagadas do armazenamento e o lote sai das métricas. Esta ação não pode ser desfeita."
        confirmar="Excluir lote"
        confirmando="Excluindo..."
        enviando={enviando}
        erro={erroAoExcluir}
        aoConfirmar={excluir}
        aoCancelar={() => setExcluindo(null)}
      />
    </div>
  )
}
