"use client"

import { useState, type FormEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Unit } from "@/lib/api-client"

export interface RegisterValues {
  unitId: string
  name: string
  description: string
}

export function RegisterDialog({ open, units, summary, pending, error, onSubmit, onCancel }: {
  open: boolean
  units: Unit[] | null
  summary: { total: number; approved: number; rejected: number; corrected: number }
  pending: boolean
  error: string | null
  onSubmit: (values: RegisterValues) => void
  onCancel: () => void
}) {
  const [unitId, setUnitId] = useState(units?.length === 1 ? units[0].id : "")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const noUnits = units !== null && units.length === 0
  const selectedUnit = unitId || (units?.length === 1 ? units[0].id : "")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedUnit) return setLocalError("Escolha a linha de onde vieram as peças.")
    if (!name.trim()) return setLocalError("Dê um nome ao lote.")
    setLocalError(null)
    onSubmit({ unitId: selectedUnit, name: name.trim(), description: description.trim() })
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next && !pending) onCancel() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Registrar lote</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            As {summary.total} capturas serão salvas com o resultado da revisão: {summary.approved} aprovadas e {summary.rejected} reprovadas
            {summary.corrected > 0 && `, ${summary.corrected} com correções suas`}.
          </DialogPrimitive.Description>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lot-unit">Linha de produção</Label>
              {noUnits ? (
                <p className="text-sm text-warning-emphasis">Você não tem linha atribuída. Fale com o administrador.</p>
              ) : (
                <Select value={selectedUnit} onValueChange={setUnitId} disabled={!units}>
                  <SelectTrigger id="lot-unit" className="h-10">
                    <SelectValue placeholder={units ? "Escolha a linha" : "Carregando linhas..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot-name">Nome do lote</Label>
              <Input id="lot-name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot-description">Observações <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="lot-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {(localError || error) && <p role="alert" className="text-sm text-danger-emphasis">{localError || error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button>
              <Button type="submit" disabled={pending || noUnits}>
                {pending && <Loader2 className="animate-spin" />}
                {pending ? "Registrando..." : "Registrar lote"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
