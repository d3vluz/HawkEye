// Os funcionários com mais capturas no período e a aprovação de cada um.

import { Users } from "lucide-react"
import { numero, percentual } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { MetricasDoDashboard } from "@/types"
import { Painel, PainelVazio } from "./painel"

const CABECALHO = "whitespace-nowrap pb-2 pl-4 text-left text-xs font-medium text-muted-foreground first:pl-0"
const NUMERO = "py-2.5 pl-4 text-right tabular-nums text-foreground"

export function Operadores({ metricas }: { metricas: MetricasDoDashboard }) {
  return (
    <Painel titulo="Quem mais inspecionou" descricao={`Os 5 funcionários com mais capturas nos últimos ${metricas.periodDays} dias`}>
      {metricas.operators.length === 0 ? (
        <PainelVazio icone={<Users className="size-8 text-muted-foreground" />} titulo="Nenhuma coleta no período" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={CABECALHO}>Funcionário</th>
              <th className={cn(CABECALHO, "text-right")}>Lotes</th>
              <th className={cn(CABECALHO, "text-right")}>Capturas</th>
              <th className={cn(CABECALHO, "text-right")}>Aprovação</th>
            </tr>
          </thead>
          <tbody>
            {metricas.operators.map((operador) => {
              const abaixo = operador.approvalRate !== null && operador.approvalRate < metricas.qualityTarget
              return (
                <tr key={operador.matricula} className="border-b border-border last:border-0">
                  <td className="py-2.5">
                    <p className="font-medium text-foreground">{operador.name ?? "Membro removido"}</p>
                    <p className="text-xs text-muted-foreground">Matrícula {operador.matricula}</p>
                  </td>
                  <td className={NUMERO}>{numero(operador.batches)}</td>
                  <td className={NUMERO}>{numero(operador.captures)}</td>
                  <td className={cn(NUMERO, "font-semibold", abaixo ? "text-danger-emphasis" : "text-success-emphasis")}>
                    {percentual(operador.approvalRate)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Painel>
  )
}
