// Os quatro indicadores do topo do dashboard, comparando o período atual com o anterior.

import { AlertTriangle, CheckCircle2, ScanSearch, Target } from "lucide-react"
import { numero, percentual, plural } from "@/lib/formato"
import type { MetricasDoDashboard } from "@/types"
import { CartaoDeIndicador, MiniGrafico, type Variacao } from "./cartao-de-indicador"

function variacaoRelativa(atual: number | null, anterior: number | null, maiorEMelhor: boolean): Variacao | null {
  if (atual === null || anterior === null || anterior === 0 || atual === anterior) return null
  const mudanca = ((atual - anterior) / anterior) * 100
  return { rotulo: `${numero(Math.abs(mudanca), 1)}%`, subiu: mudanca > 0, melhorou: mudanca > 0 === maiorEMelhor }
}

// Taxas comparam em pontos percentuais: de 80% para 88% é +8 p.p., não +10%.
function variacaoEmPontos(atual: number | null, anterior: number | null): Variacao | null {
  if (atual === null || anterior === null) return null
  const diferenca = atual - anterior
  if (Math.abs(diferenca) < 0.05) return null
  return { rotulo: `${numero(Math.abs(diferenca), 1)} p.p.`, subiu: diferenca > 0, melhorou: diferenca > 0 }
}

const media = (valor: number | null) => (valor === null ? "—" : numero(valor, 2))

export function Indicadores({ metricas }: { metricas: MetricasDoDashboard }) {
  const { current: atual, previous: anterior, series: serie, periodDays: dias, qualityTarget: meta } = metricas
  const periodo = `${dias} dias`
  const parteAbaixo = atual.batches > 0 ? (atual.belowTarget / atual.batches) * 100 : 0
  const rodape = (valor: string) => <>{dias} dias anteriores: <strong className="font-semibold text-foreground">{valor}</strong></>

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <CartaoDeIndicador
        icone={ScanSearch}
        tom="signal"
        titulo="Capturas inspecionadas"
        ajuda={`Imagens de lotes registrados nos últimos ${periodo}, comparadas com os ${periodo} anteriores.`}
        valor={numero(atual.captures)}
        variacao={variacaoRelativa(atual.captures, anterior.captures, true)}
        legenda={`${plural(atual.batches, "lote", "lotes")} nos últimos ${periodo}`}
        grafico={<MiniGrafico valores={serie.map((d) => d.captures)} tom="signal" />}
        rodape={rodape(numero(anterior.captures))}
      />
      <CartaoDeIndicador
        icone={CheckCircle2}
        tom="success"
        titulo="Taxa de aprovação"
        ajuda="Parte das capturas sem nenhum defeito que reprova, segundo os critérios de inspeção."
        valor={percentual(atual.approvalRate)}
        variacao={variacaoEmPontos(atual.approvalRate, anterior.approvalRate)}
        legenda={`Meta: ${meta}% de capturas válidas`}
        grafico={<MiniGrafico valores={serie.map((d) => d.approvalRate)} tom="success" />}
        rodape={rodape(percentual(anterior.approvalRate))}
      />
      <CartaoDeIndicador
        icone={AlertTriangle}
        tom="warning"
        titulo="Defeitos por captura"
        ajuda="Média de defeitos encontrados em cada imagem. Quanto menor, melhor."
        valor={media(atual.defectsPerCapture)}
        variacao={variacaoRelativa(atual.defectsPerCapture, anterior.defectsPerCapture, false)}
        legenda="Média por imagem inspecionada"
        grafico={<MiniGrafico valores={serie.map((d) => d.defectsPerCapture)} tom="warning" />}
        rodape={rodape(media(anterior.defectsPerCapture))}
      />
      <CartaoDeIndicador
        icone={Target}
        tom="danger"
        titulo="Lotes abaixo da meta"
        ajuda={`Lotes com menos de ${meta}% de capturas válidas. A meta é definida em Configurações.`}
        valor={numero(atual.belowTarget)}
        variacao={variacaoRelativa(atual.belowTarget, anterior.belowTarget, false)}
        legenda={atual.batches > 0 ? `${percentual(parteAbaixo, 0)} de ${plural(atual.batches, "lote", "lotes")} do período` : "Nenhum lote no período"}
        grafico={
          <div className="flex h-12 items-end">
            <div className="h-2 w-full overflow-hidden rounded-full bg-success/25" role="img" aria-label={`${percentual(parteAbaixo, 0)} dos lotes abaixo da meta`}>
              <div className="h-full rounded-full bg-danger/70" style={{ width: `${parteAbaixo}%` }} />
            </div>
          </div>
        }
        rodape={rodape(numero(anterior.belowTarget))}
      />
    </div>
  )
}
