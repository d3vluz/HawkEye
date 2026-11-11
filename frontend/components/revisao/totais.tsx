// Totais de um lote (capturas, aprovadas, reprovadas e corrigidas), usados na revisão e no detalhe.

import { PontoDeStatus } from "./lista-de-capturas"

export interface Totais {
  capturas: number
  aprovadas: number
  reprovadas: number
  corrigidas: number
}

export function TotaisDoLote({ totais, className }: { totais: Totais; className?: string }) {
  const itens = [
    { rotulo: "Capturas", valor: totais.capturas, ponto: null },
    { rotulo: "Aprovadas", valor: totais.aprovadas, ponto: false },
    { rotulo: "Reprovadas", valor: totais.reprovadas, ponto: true },
    { rotulo: "Corrigidas", valor: totais.corrigidas, ponto: null },
  ]
  return (
    <dl className={className ?? "flex flex-wrap gap-x-6 gap-y-2 text-sm"}>
      {itens.map((item) => (
        <div key={item.rotulo}>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            {item.ponto !== null && <PontoDeStatus reprovada={item.ponto} />}
            {item.rotulo}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{item.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
