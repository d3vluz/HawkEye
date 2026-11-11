"use client"

// Seção "Armazenamento": espaço usado nos buckets e limpeza das revisões abandonadas.

import { useEffect, useState } from "react"
import { RefreshCw, Trash2 } from "lucide-react"
import { DialogoDeConfirmacao } from "@/components/dialogo-de-confirmacao"
import { Button } from "@/components/ui/button"
import { limparRevisoesAbandonadas, usoDoArmazenamento } from "@/lib/api"
import { bytes, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { UsoDoArmazenamento } from "@/types"
import { Aviso, PainelDeConfiguracao } from "./painel"

export function SecaoDeArmazenamento() {
  const [uso, setUso] = useState<UsoDoArmazenamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [erroAoLimpar, setErroAoLimpar] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const atualizar = () => {
    setCarregando(true)
    return usoDoArmazenamento()
      .then((u) => { setUso(u); setErro(null) })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { atualizar() }, [])

  const limpar = async () => {
    setLimpando(true)
    try {
      const removidas = await limparRevisoesAbandonadas()
      setConfirmando(false)
      setResultado(`${plural(removidas.sessions, "revisão removida", "revisões removidas")}, ${bytes(removidas.bytes)} liberados.`)
      await atualizar()
    } catch (e) {
      setErroAoLimpar((e as Error).message)
    } finally {
      setLimpando(false)
    }
  }

  const buckets = uso && [
    { rotulo: "Aprovadas", dica: "Imagens dos lotes registrados", ...uso.permanent },
    { rotulo: "Em revisão", dica: "Inspeções ainda não registradas nem reprovadas", ...uso.review },
  ]

  return (
    <PainelDeConfiguracao
      titulo="Armazenamento"
      descricao="Espaço ocupado pelas imagens no MinIO. Quando uma inspeção é abandonada sem registrar nem reprovar, as imagens ficam na revisão até serem limpas aqui."
      acao={
        <Button variant="outline" size="sm" onClick={atualizar} disabled={carregando}>
          <RefreshCw className={cn("size-4", carregando && "animate-spin")} /> Atualizar
        </Button>
      }
    >
      {erro && <Aviso erro>{erro}</Aviso>}
      {!uso && !erro && <Aviso>Lendo o armazenamento...</Aviso>}

      {uso && buckets && (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {buckets.map((bucket) => (
              <div key={bucket.rotulo} className="rounded-lg border border-border p-4">
                <dt className="text-sm font-medium text-muted-foreground">{bucket.rotulo}</dt>
                <dd className="mt-1 text-2xl font-bold text-foreground tabular-nums">{bytes(bucket.bytes)}</dd>
                <dd className="text-xs text-muted-foreground">{plural(bucket.objects, "arquivo", "arquivos")} · {bucket.dica}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Revisões abandonadas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {uso.abandoned.sessions === 0
                  ? `Nenhuma inspeção parada há mais de ${uso.abandonedAfterHours} horas.`
                  : `${plural(uso.abandoned.sessions, "inspeção parada", "inspeções paradas")} há mais de ${uso.abandonedAfterHours} horas: ${plural(uso.abandoned.objects, "arquivo", "arquivos")}, ${bytes(uso.abandoned.bytes)}.`}
              </p>
              {resultado && <p className="mt-1 text-sm text-success-emphasis" aria-live="polite">{resultado}</p>}
            </div>
            <Button
              variant="outline"
              className="shrink-0 text-danger-emphasis hover:bg-danger/10 hover:text-danger-emphasis"
              disabled={uso.abandoned.sessions === 0}
              onClick={() => { setErroAoLimpar(null); setResultado(null); setConfirmando(true) }}
            >
              <Trash2 className="size-4" /> Limpar abandonadas
            </Button>
          </div>
        </div>
      )}

      <DialogoDeConfirmacao
        aberto={confirmando}
        titulo="Limpar as revisões abandonadas?"
        descricao={`Apaga as imagens de inspeções sem atividade há mais de ${uso?.abandonedAfterHours ?? 24} horas. Inspeções recentes e lotes registrados não são afetados. Esta ação não pode ser desfeita.`}
        confirmar="Limpar revisões"
        confirmando="Limpando..."
        enviando={limpando}
        erro={erroAoLimpar}
        aoConfirmar={limpar}
        aoCancelar={() => setConfirmando(false)}
      />
    </PainelDeConfiguracao>
  )
}
