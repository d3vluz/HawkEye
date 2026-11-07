"use client"

// Diálogo que pede linha, nome e observações antes de registrar o lote revisado.

import { useState, type FormEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Linha } from "@/types"
import type { Totais } from "./totais"

export interface DadosDoRegistro {
  linhaId: string
  nome: string
  observacoes: string
}

export function DialogoDeRegistro({ linhas, totais, enviando, erro, aoRegistrar, aoCancelar }: {
  linhas: Linha[] | null
  totais: Totais
  enviando: boolean
  erro: string | null
  aoRegistrar: (dados: DadosDoRegistro) => void
  aoCancelar: () => void
}) {
  const [linhaId, setLinhaId] = useState("")
  const [nome, setNome] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const semLinhas = linhas !== null && linhas.length === 0
  const linhaEscolhida = linhaId || (linhas?.length === 1 ? linhas[0].id : "")

  const registrar = (evento: FormEvent) => {
    evento.preventDefault()
    if (!linhaEscolhida) return setErroLocal("Escolha a linha de onde vieram as peças.")
    if (!nome.trim()) return setErroLocal("Dê um nome ao lote.")
    setErroLocal(null)
    aoRegistrar({ linhaId: linhaEscolhida, nome: nome.trim(), observacoes: observacoes.trim() })
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(aberto) => { if (!aberto && !enviando) aoCancelar() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Registrar lote</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            As {totais.capturas} capturas serão salvas com o resultado da revisão: {totais.aprovadas} aprovadas e {totais.reprovadas} reprovadas
            {totais.corrigidas > 0 && `, ${totais.corrigidas} com correções suas`}.
          </DialogPrimitive.Description>

          <form onSubmit={registrar} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lote-linha">Linha de produção</Label>
              {semLinhas ? (
                <p className="text-sm text-warning-emphasis">Você não tem linha atribuída. Fale com o administrador.</p>
              ) : (
                <Select value={linhaEscolhida} onValueChange={setLinhaId} disabled={!linhas}>
                  <SelectTrigger id="lote-linha" className="h-10">
                    <SelectValue placeholder={linhas ? "Escolha a linha" : "Carregando linhas..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {linhas?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lote-nome">Nome do lote</Label>
              <Input id="lote-nome" className="h-10" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lote-observacoes">Observações <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="lote-observacoes" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>

            {(erroLocal || erro) && <p role="alert" className="text-sm text-danger-emphasis">{erroLocal || erro}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={aoCancelar} disabled={enviando}>Cancelar</Button>
              <Button type="submit" disabled={enviando || semLinhas}>
                {enviando && <Loader2 className="animate-spin" />}
                {enviando ? "Registrando..." : "Registrar lote"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
