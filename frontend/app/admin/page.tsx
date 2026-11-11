"use client"

// Dashboard do admin: indicadores do período, tendência, defeitos, linhas, operadores e lotes recentes.

import { useEffect, useState } from "react"
import { Loader2, Package } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { DefeitosPorTipo } from "@/components/dashboard/defeitos-por-tipo"
import { Indicadores } from "@/components/dashboard/indicadores"
import { LinhasDeProducao } from "@/components/dashboard/linhas-de-producao"
import { LotesRecentes } from "@/components/dashboard/lotes-recentes"
import { Operadores } from "@/components/dashboard/operadores"
import { QualidadePorDia } from "@/components/dashboard/qualidade-por-dia"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listarLinhas, metricasDoDashboard } from "@/lib/api"
import { percentual, plural } from "@/lib/formato"
import type { Linha, MetricasDoDashboard } from "@/types"

const TODAS = "todas"
const ATUALIZAR_A_CADA_MS = 30_000

export default function PaginaDoDashboard() {
  const [metricas, setMetricas] = useState<MetricasDoDashboard | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [filtro, setFiltro] = useState(TODAS)
  const linha = filtro === TODAS ? undefined : filtro

  useEffect(() => {
    listarLinhas().then(setLinhas).catch(() => setLinhas([]))
  }, [])

  useEffect(() => {
    const carregar = () =>
      metricasDoDashboard(linha)
        .then((m) => { setMetricas(m); setErro(null) })
        .catch((e: Error) => setErro(e.message))
    carregar()
    const intervalo = setInterval(carregar, ATUALIZAR_A_CADA_MS)
    return () => clearInterval(intervalo)
  }, [linha])

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <Cabecalho
        trilha={[{ rotulo: "Admin" }, { rotulo: "Dashboard" }]}
        titulo="Dashboard"
        descricao={
          metricas
            ? `Últimos ${metricas.periodDays} dias comparados com os ${metricas.periodDays} anteriores. Desde o início: ${plural(metricas.totals.batches, "lote", "lotes")}, ${plural(metricas.totals.captures, "captura", "capturas")} e ${percentual(metricas.totals.approvalRate)} de aprovação.`
            : "Qualidade das inspeções registradas."
        }
        acoes={
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-9 w-48" aria-label="Filtrar por linha">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as linhas</SelectItem>
              {linhas.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {erro && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger-emphasis">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{erro}</p>
        </div>
      )}

      {!metricas && !erro && (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-12 animate-spin text-signal" aria-label="Carregando dashboard" />
        </div>
      )}

      {metricas && metricas.totals.batches === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Package className="size-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">{linha ? "Esta linha ainda não tem lotes registrados" : "Nenhum lote registrado ainda"}</p>
          <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            As métricas aparecem quando um funcionário registra o primeiro lote na inspeção.
          </p>
          {linha && (
            <button onClick={() => setFiltro(TODAS)} className="mt-4 text-sm font-medium text-primary-emphasis hover:underline">
              Ver todas as linhas
            </button>
          )}
        </div>
      )}

      {metricas && metricas.totals.batches > 0 && (
        <div className="space-y-6">
          <Indicadores metricas={metricas} />
          <div className="grid gap-6 xl:grid-cols-3">
            <QualidadePorDia metricas={metricas} />
            <DefeitosPorTipo metricas={metricas} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <LinhasDeProducao metricas={metricas} linhaSelecionada={linha} />
            <Operadores metricas={metricas} />
          </div>
          <LotesRecentes metricas={metricas} />
        </div>
      )}
    </div>
  )
}
