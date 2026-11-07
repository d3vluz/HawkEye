"use client"

// Veredito da captura em revisão e as seis verificações, cada uma com o controle OK/Defeito do operador.

import { CheckCircle2, CircleAlert, Undo2, XCircle } from "lucide-react"
import { VERIFICACOES, reprova } from "@/lib/defeitos"
import type { Correcoes } from "@/lib/defeitos"
import { cn } from "@/lib/utils"
import type { Camada, Criterios, Defeito, Defeitos, ResultadoDaAnalise } from "@/types"

export function PainelDeVerificacoes({ analise, defeitos, correcoes, criterios, camada, aoMarcar, aoDesfazer, aoMostrar }: {
  analise: ResultadoDaAnalise
  defeitos: Defeitos
  correcoes: Correcoes | undefined
  criterios: Criterios | null
  camada: Camada
  aoMarcar: (defeito: Defeito, temDefeito: boolean) => void
  aoDesfazer: () => void
  aoMostrar: (camada: Camada) => void
}) {
  const reprovacoes = VERIFICACOES.filter((v) => defeitos[v.defeito] && reprova(v.defeito, criterios))
  const reprovada = reprovacoes.length > 0

  return (
    <section aria-label="Verificações da captura" className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          {reprovada ? <XCircle className="size-5 text-danger-emphasis" /> : <CheckCircle2 className="size-5 text-success-emphasis" />}
          <h2 className="text-base font-semibold text-foreground">{reprovada ? "Captura reprovada" : "Captura aprovada"}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {reprovada
            ? `Motivo: ${reprovacoes.map((v) => v.titulo.toLowerCase()).join(", ")}.`
            : "Nenhum defeito que reprove a peça pelos critérios atuais."}
        </p>
        {Object.keys(correcoes ?? {}).length > 0 && (
          <button onClick={aoDesfazer} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-emphasis hover:underline">
            <Undo2 className="size-3.5" /> Desfazer minhas correções
          </button>
        )}
      </div>

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Confira cada item na imagem. Se o sistema errou, marque o resultado certo.
      </p>

      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-2 pb-2">
        {VERIFICACOES.map((v) => {
          const temDefeito = defeitos[v.defeito]
          const corrigida = correcoes?.[v.defeito] !== undefined
          const tolerado = temDefeito && !reprova(v.defeito, criterios)
          const detalhe = corrigida
            ? temDefeito ? "Você marcou como defeito" : `O sistema apontou ${v.encontrado(analise, criterios).toLowerCase()}; você marcou como OK`
            : temDefeito ? v.encontrado(analise, criterios) : v.semDefeito

          return (
            <li key={v.defeito} className="py-1">
              <div className={cn("flex items-start gap-2.5 rounded-lg px-2 py-2", camada === v.camada && "bg-muted/50")}>
                <span className="mt-0.5">
                  {temDefeito
                    ? <CircleAlert className={cn("size-4", tolerado ? "text-warning-emphasis" : "text-danger-emphasis")} />
                    : <CheckCircle2 className="size-4 text-success-emphasis" />}
                </span>
                <button onClick={() => aoMostrar(v.camada)} className="min-w-0 flex-1 text-left" title="Mostrar a camada correspondente">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                    {v.titulo}
                    {corrigida && <span className="text-[11px] font-medium text-primary-emphasis">· corrigido</span>}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{detalhe}</span>
                  {tolerado && <span className="block text-xs text-warning-emphasis">Não reprova pelos critérios atuais</span>}
                </button>
                <div role="radiogroup" aria-label={`Resultado de ${v.titulo}`} className="flex shrink-0 rounded-md bg-muted p-0.5">
                  {([false, true] as const).map((opcao) => (
                    <button
                      key={String(opcao)}
                      role="radio"
                      aria-checked={temDefeito === opcao}
                      onClick={() => aoMarcar(v.defeito, opcao)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        temDefeito === opcao ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opcao ? "Defeito" : "OK"}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
