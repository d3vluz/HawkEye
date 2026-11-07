"use client"

// Seção "Status do sistema": a API testa a conexão com banco, armazenamento e worker.

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { statusDoSistema } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { StatusDoSistema, VerificacaoDeServico } from "@/types"
import { Aviso, PainelDeConfiguracao } from "./painel"

function tempoNoAr(segundos: number) {
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (dias > 0) return `${dias} d ${horas} h`
  if (horas > 0) return `${horas} h ${minutos} min`
  return `${minutos} min`
}

export function SecaoDeStatus() {
  const [status, setStatus] = useState<StatusDoSistema | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [apiFora, setApiFora] = useState(false)

  const verificar = () => {
    setCarregando(true)
    statusDoSistema()
      .then((s) => { setStatus(s); setApiFora(false) })
      .catch(() => setApiFora(true))
      .finally(() => setCarregando(false))
  }

  useEffect(verificar, [])

  const servico = (nome: string, papel: string, v: VerificacaoDeServico) =>
    ({ nome, papel, online: v.status === "online", detalhe: `${v.latencyMs} ms`, erro: v.error })

  const servicos = status && [
    { nome: "API", papel: "Orquestra o sistema", online: true, detalhe: `No ar há ${tempoNoAr(status.api.uptimeSeconds)}`, erro: undefined },
    servico("Banco de dados", "PostgreSQL", status.database),
    servico("Armazenamento", "MinIO, buckets de revisão e aprovadas", status.storage),
    servico("Worker de visão", "Processamento OpenCV", status.worker),
  ]

  return (
    <PainelDeConfiguracao
      titulo="Status do sistema"
      descricao="Conexão da API com cada serviço do HawkEye. Se algum estiver fora, as inspeções param nesse ponto."
      acao={
        <Button variant="outline" size="sm" onClick={verificar} disabled={carregando}>
          <RefreshCw className={cn("size-4", carregando && "animate-spin")} /> Verificar agora
        </Button>
      }
      rodape={status && !apiFora ? <p className="text-xs text-muted-foreground">Verificado às {new Date(status.checkedAt).toLocaleTimeString("pt-BR")}.</p> : undefined}
    >
      {apiFora && <Aviso erro>A API não respondeu. Sem ela, nenhum outro serviço pode ser verificado.</Aviso>}
      {!status && !apiFora && <Aviso>Verificando serviços...</Aviso>}

      {servicos && !apiFora && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {servicos.map((servico) => (
            <li key={servico.nome} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{servico.nome}</p>
                <p className="text-xs text-muted-foreground">{servico.papel}</p>
                {!servico.online && servico.erro && <p className="mt-1 text-xs break-words text-danger-emphasis">{servico.erro}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums">{servico.detalhe}</span>
                <span className={cn("inline-flex items-center gap-1.5 font-medium", servico.online ? "text-success-emphasis" : "text-danger-emphasis")}>
                  <span className={cn("size-2 rounded-full", servico.online ? "bg-success" : "bg-danger")} aria-hidden />
                  {servico.online ? "Online" : "Fora do ar"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PainelDeConfiguracao>
  )
}
