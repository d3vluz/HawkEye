"use client"

// Seção "Linhas de produção": criar, renomear e remover linhas (só as que ainda não têm lotes).

import { useEffect, useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { DialogoDeConfirmacao } from "@/components/dialogo-de-confirmacao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { criarLinha, listarLinhas, removerLinha, renomearLinha } from "@/lib/api"
import { plural } from "@/lib/formato"
import type { Linha, LinhaComTotais } from "@/types"
import { Aviso, PainelDeConfiguracao } from "./painel"

export function SecaoDeLinhas() {
  const [linhas, setLinhas] = useState<LinhaComTotais[] | null>(null)
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState("")
  const [editando, setEditando] = useState<Linha | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<LinhaComTotais | null>(null)
  const [enviandoRemocao, setEnviandoRemocao] = useState(false)
  const [erroAoRemover, setErroAoRemover] = useState<string | null>(null)

  const atualizar = () =>
    listarLinhas()
      .then((l) => { setLinhas(l); setErroAoCarregar(null) })
      .catch((e: Error) => setErroAoCarregar(e.message))

  useEffect(() => { atualizar() }, [])

  const salvar = async (evento: FormEvent, acao: () => Promise<unknown>, depois: () => void) => {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await acao()
      depois()
      await atualizar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    if (!removendo) return
    setEnviandoRemocao(true)
    try {
      await removerLinha(removendo.id)
      setRemovendo(null)
      await atualizar()
    } catch (e) {
      setErroAoRemover((e as Error).message)
    } finally {
      setEnviandoRemocao(false)
    }
  }

  return (
    <PainelDeConfiguracao
      titulo="Linhas de produção"
      descricao="De onde vêm as peças. O funcionário escolhe a linha ao registrar o lote, entre as que tem acesso, e os lotes e métricas podem ser filtrados por ela."
    >
      <form
        onSubmit={(e) => salvar(e, () => criarLinha(novoNome), () => setNovoNome(""))}
        className="mb-6 flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="nova-linha" className="sr-only">Nome da nova linha</label>
        <Input id="nova-linha" placeholder="Nome da nova linha, ex.: Linha D" maxLength={40} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="sm:max-w-sm" />
        <Button type="submit" disabled={salvando || !novoNome.trim()}>
          <Plus className="size-4" /> Adicionar linha
        </Button>
      </form>
      {erro && <div className="mb-4"><Aviso erro>{erro}</Aviso></div>}

      {erroAoCarregar && <Aviso erro>{erroAoCarregar}</Aviso>}
      {!linhas && !erroAoCarregar && <Aviso>Carregando linhas...</Aviso>}
      {linhas?.length === 0 && <Aviso>Nenhuma linha cadastrada. Sem linha, o funcionário não consegue registrar lotes.</Aviso>}

      {linhas && linhas.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {linhas.map((linha) => (
            <li key={linha.id} className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editando?.id === linha.id ? (
                <form
                  onSubmit={(e) => salvar(e, () => renomearLinha(editando.id, editando.name), () => setEditando(null))}
                  className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <label htmlFor={`renomear-${linha.id}`} className="sr-only">Novo nome de {linha.name}</label>
                  <Input
                    id={`renomear-${linha.id}`}
                    autoFocus
                    maxLength={40}
                    value={editando.name}
                    onChange={(e) => setEditando({ id: linha.id, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditando(null) }}
                    className="sm:max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={salvando || !editando.name.trim()}>
                      <Check className="size-4" /> {salvando ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>
                      <X className="size-4" /> Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{linha.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {plural(linha.memberCount, "membro", "membros")} · {plural(linha.batchCount, "lote", "lotes")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Renomear ${linha.name}`} onClick={() => { setErro(null); setEditando(linha) }}>
                      <Pencil className="size-4" /> Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger-emphasis hover:bg-danger/10 hover:text-danger-emphasis"
                      disabled={linha.batchCount > 0}
                      title={linha.batchCount > 0 ? "Linhas com lotes não podem ser removidas" : undefined}
                      aria-label={`Remover ${linha.name}`}
                      onClick={() => { setErroAoRemover(null); setRemovendo(linha) }}
                    >
                      <Trash2 className="size-4" /> Remover
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {linhas?.some((l) => l.batchCount > 0) && (
        <p className="mt-3 text-xs text-muted-foreground">Linhas com lotes não podem ser removidas, para as métricas não perderem a origem. Renomeie quando precisar.</p>
      )}

      <DialogoDeConfirmacao
        aberto={removendo !== null}
        titulo={`Remover ${removendo?.name ?? ""}?`}
        descricao="Os membros vinculados só a esta linha ficam sem acesso a nenhuma e não conseguem registrar lotes até receberem outra."
        confirmar="Remover linha"
        confirmando="Removendo..."
        enviando={enviandoRemocao}
        erro={erroAoRemover}
        aoConfirmar={remover}
        aoCancelar={() => setRemovendo(null)}
      />
    </PainelDeConfiguracao>
  )
}
