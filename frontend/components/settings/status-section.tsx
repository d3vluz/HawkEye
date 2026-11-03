"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PanelState, SettingsPanel } from "@/components/settings/panel"
import { cn } from "@/lib/utils"
import { getSystemStatus, type SystemStatus } from "@/lib/api-client"

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

export function StatusSection() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiDown, setApiDown] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      setStatus(await getSystemStatus())
      setApiDown(false)
    } catch {
      setApiDown(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const services = status && [
    { name: "API", role: "Orquestra o sistema", online: true, detail: `No ar há ${formatUptime(status.api.uptimeSeconds)}` },
    { name: "Banco de dados", role: "PostgreSQL", online: status.database.status === "online", detail: `${status.database.latencyMs} ms`, error: status.database.error },
    { name: "Armazenamento", role: "MinIO, buckets de revisão e aprovadas", online: status.storage.status === "online", detail: `${status.storage.latencyMs} ms`, error: status.storage.error },
    { name: "Worker de visão", role: "Processamento OpenCV", online: status.worker.status === "online", detail: `${status.worker.latencyMs} ms`, error: status.worker.error },
  ]

  return (
    <SettingsPanel
      title="Status do sistema"
      description="Conexão da API com cada serviço do HawkEye. Se algum estiver fora, as inspeções param nesse ponto."
      action={
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Verificar agora
        </Button>
      }
      footer={status && !apiDown ? <p className="text-xs text-muted-foreground">Verificado às {new Date(status.checkedAt).toLocaleTimeString("pt-BR")}.</p> : undefined}
    >
      {apiDown && <PanelState tone="danger">A API não respondeu. Sem ela, nenhum outro serviço pode ser verificado.</PanelState>}
      {!status && !apiDown && <PanelState>Verificando serviços...</PanelState>}

      {services && !apiDown && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {services.map((service) => (
            <li key={service.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{service.name}</p>
                <p className="text-xs text-muted-foreground">{service.role}</p>
                {!service.online && service.error && <p className="mt-1 break-words text-xs text-danger-emphasis">{service.error}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums">{service.detail}</span>
                <span className={cn("inline-flex items-center gap-1.5 font-medium", service.online ? "text-success-emphasis" : "text-danger-emphasis")}>
                  <span className={cn("h-2 w-2 rounded-full", service.online ? "bg-success" : "bg-danger")} aria-hidden />
                  {service.online ? "Online" : "Fora do ar"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsPanel>
  )
}
