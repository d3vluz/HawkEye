"use client"

// Seção "Critérios de inspeção": grade esperada, meta de qualidade e quais defeitos reprovam a captura.

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lerCriterios, salvarCriterios } from "@/lib/api"
import type { Criterios } from "@/types"
import { Aviso, PainelDeConfiguracao } from "./painel"

type ChaveDeReprovacao = Extract<keyof Criterios, `reject${string}`>

const DEFEITOS: Array<{ chave: ChaveDeReprovacao; rotulo: string; dica: string }> = [
  { chave: "rejectMissingPins", rotulo: "Pino ausente", dica: "Compartimento vazio." },
  { chave: "rejectExtraPins", rotulo: "Pino extra", dica: "Mais de um pino no mesmo compartimento." },
  { chave: "rejectDamagedPins", rotulo: "Pino danificado", dica: "Pino menor que o esperado." },
  { chave: "rejectWrongColorPins", rotulo: "Cor incorreta", dica: "Pino fora do amarelo padrão." },
  { chave: "rejectShaftDefects", rotulo: "Defeito na haste", dica: "Haste torta ou fora do comprimento." },
  { chave: "rejectStructureDamage", rotulo: "Dano estrutural", dica: "Divisória ausente ou grade diferente da esperada." },
]

const TITULO = "Critérios de inspeção"

const iguais = (a: Criterios, b: Criterios) => (Object.keys(a) as Array<keyof Criterios>).every((chave) => a[chave] === b[chave])
// Campo vazio vira NaN para o botão de salvar ficar bloqueado até a pessoa digitar um número.
const paraNumero = (texto: string) => (texto === "" ? NaN : Number(texto))
const noCampo = (valor: number | null) => (valor === null || Number.isNaN(valor) ? "" : valor)

function CampoNumerico({ id, valor, invalido, aoMudar, ...props }: {
  id: string
  valor: number | null
  invalido: boolean
  aoMudar: (valor: number) => void
  min: number
  max: number
  "aria-describedby"?: string
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      className="w-24 tabular-nums"
      aria-invalid={invalido || undefined}
      value={noCampo(valor)}
      onChange={(e) => aoMudar(paraNumero(e.target.value))}
      {...props}
    />
  )
}

export function SecaoDeCriterios() {
  const [salvos, setSalvos] = useState<Criterios | null>(null)
  const [rascunho, setRascunho] = useState<Criterios | null>(null)
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [acabouDeSalvar, setAcabouDeSalvar] = useState(false)

  useEffect(() => {
    lerCriterios()
      .then((c) => { setSalvos(c); setRascunho(c) })
      .catch((e: Error) => setErroAoCarregar(e.message))
  }, [])

  if (erroAoCarregar) return <PainelDeConfiguracao titulo={TITULO}><Aviso erro>{erroAoCarregar}</Aviso></PainelDeConfiguracao>
  if (!salvos || !rascunho) return <PainelDeConfiguracao titulo={TITULO}><Aviso>Carregando critérios...</Aviso></PainelDeConfiguracao>

  const confereGrade = rascunho.expectedRows !== null && rascunho.expectedCols !== null
  const alterado = !iguais(salvos, rascunho)
  const gradeInvalida = confereGrade && [rascunho.expectedRows, rascunho.expectedCols].some((n) => !Number.isInteger(n) || n! < 1 || n! > 50)
  const metaInvalida = !Number.isInteger(rascunho.minQualityScore) || rascunho.minQualityScore < 0 || rascunho.minQualityScore > 100

  const alterar = (mudanca: Partial<Criterios>) => {
    setAcabouDeSalvar(false)
    setRascunho({ ...rascunho, ...mudanca })
  }

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    setSalvando(true)
    setErroAoSalvar(null)
    try {
      const novos = await salvarCriterios(rascunho)
      setSalvos(novos)
      setRascunho(novos)
      setAcabouDeSalvar(true)
    } catch (e) {
      setErroAoSalvar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const situacao = erroAoSalvar
    ? <span className="text-danger-emphasis">{erroAoSalvar}</span>
    : acabouDeSalvar
      ? "Critérios salvos. Valem para os próximos lotes."
      : salvos.updatedAt && salvos.updatedByMatricula
        ? `Última alteração pela matrícula ${salvos.updatedByMatricula} em ${new Date(salvos.updatedAt).toLocaleString("pt-BR")}.`
        : "Usando os critérios padrão."

  return (
    <form onSubmit={salvar}>
      <PainelDeConfiguracao
        titulo={TITULO}
        descricao="O padrão de qualidade que decide se uma captura é válida. A API aplica estes critérios quando o lote é registrado. Os lotes já salvos mantêm o resultado que tinham."
        rodape={
          <>
            <p className="text-xs text-muted-foreground" aria-live="polite">{situacao}</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={!alterado || salvando} onClick={() => setRascunho(salvos)}>Descartar</Button>
              <Button type="submit" disabled={!alterado || salvando || gradeInvalida || metaInvalida}>{salvando ? "Salvando..." : "Salvar critérios"}</Button>
            </div>
          </>
        }
      >
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Grade esperada</legend>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={confereGrade}
                  onChange={(e) => alterar(e.target.checked ? { expectedRows: 3, expectedCols: 5 } : { expectedRows: null, expectedCols: null })}
                />
                Conferir a grade da peça
              </label>
              {confereGrade && (
                <div className="flex items-end gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="linhas-esperadas" className="text-xs font-medium text-muted-foreground">Linhas</label>
                    <CampoNumerico id="linhas-esperadas" min={1} max={50} invalido={gradeInvalida} valor={rascunho.expectedRows} aoMudar={(v) => alterar({ expectedRows: v })} />
                  </div>
                  <span className="pb-2 text-muted-foreground" aria-hidden>×</span>
                  <div className="space-y-1.5">
                    <label htmlFor="colunas-esperadas" className="text-xs font-medium text-muted-foreground">Colunas</label>
                    <CampoNumerico id="colunas-esperadas" min={1} max={50} invalido={gradeInvalida} valor={rascunho.expectedCols} aoMudar={(v) => alterar({ expectedCols: v })} />
                  </div>
                </div>
              )}
              <p className="text-xs text-pretty text-muted-foreground">
                {confereGrade
                  ? "Se a grade detectada tiver outro tamanho, a captura recebe dano estrutural. Use entre 1 e 50."
                  : "Sem conferência, o tamanho da grade não reprova a captura; divisórias ausentes continuam contando como dano estrutural."}
              </p>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="meta-de-qualidade" className="text-sm font-semibold text-foreground">Meta de qualidade do lote</label>
              <div className="flex items-center gap-2">
                <CampoNumerico
                  id="meta-de-qualidade"
                  min={0}
                  max={100}
                  invalido={metaInvalida}
                  aria-describedby="dica-da-meta"
                  valor={rascunho.minQualityScore}
                  aoMudar={(v) => alterar({ minQualityScore: v })}
                />
                <span className="text-sm text-muted-foreground">% de capturas válidas</span>
              </div>
              <p id="dica-da-meta" className="text-xs text-pretty text-muted-foreground">Lotes abaixo da meta aparecem destacados na lista de lotes. Use de 0 a 100.</p>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Defeitos que reprovam a captura</legend>
            <p className="mt-1 text-xs text-muted-foreground">Desmarcados, continuam contados nas métricas, mas não invalidam a captura.</p>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {DEFEITOS.map(({ chave, rotulo, dica }) => (
                <li key={chave}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={rascunho[chave]} onChange={(e) => alterar({ [chave]: e.target.checked })} />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{rotulo}</span>
                      <span className="block text-xs text-muted-foreground">{dica}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      </PainelDeConfiguracao>
    </form>
  )
}
