"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelState, SettingsPanel } from "@/components/settings/panel"
import { createUnit, deleteUnit, getUnits, renameUnit, type UnitSummary } from "@/lib/api-client"

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function UnitsSection() {
  const [units, setUnits] = useState<UnitSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<UnitSummary | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setUnits(await getUnits())
      setLoadError(null)
    } catch (error) {
      setLoadError((error as Error).message)
    }
  }

  useEffect(() => { refresh() }, [])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setFormError(null)
    try {
      await createUnit(newName)
      setNewName("")
      await refresh()
    } catch (error) {
      setFormError((error as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const handleRename = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing?.name.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await renameUnit(editing.id, editing.name)
      setEditing(null)
      await refresh()
    } catch (error) {
      setFormError((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await deleteUnit(removeTarget.id)
      setRemoveTarget(null)
      await refresh()
    } catch (error) {
      setRemoveError((error as Error).message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <SettingsPanel
      title="Unidades"
      description="Linhas de produção de onde vêm as peças. O funcionário escolhe a linha ao aprovar o lote, entre as que tem acesso, e os lotes e métricas podem ser filtrados por ela."
    >
      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="new-unit" className="sr-only">Nome da nova unidade</label>
        <Input
          id="new-unit"
          placeholder="Nome da nova unidade, ex.: Linha D"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={adding || !newName.trim()}>
          <Plus className="h-4 w-4" /> {adding ? "Adicionando..." : "Adicionar unidade"}
        </Button>
      </form>
      {formError && <div className="mb-4"><PanelState tone="danger">{formError}</PanelState></div>}

      {loadError && <PanelState tone="danger">{loadError}</PanelState>}
      {!units && !loadError && <PanelState>Carregando unidades...</PanelState>}
      {units?.length === 0 && <PanelState>Nenhuma unidade cadastrada. Sem unidade, o funcionário não consegue aprovar lotes.</PanelState>}

      {units && units.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {units.map((unit) => (
            <li key={unit.id} className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editing?.id === unit.id ? (
                <form onSubmit={handleRename} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <label htmlFor={`rename-${unit.id}`} className="sr-only">Novo nome de {unit.name}</label>
                  <Input
                    id={`rename-${unit.id}`}
                    autoFocus
                    maxLength={40}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: unit.id, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditing(null) }}
                    className="sm:max-w-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving || !editing.name.trim()}>
                      <Check className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{unit.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {plural(unit.memberCount, "membro", "membros")} · {plural(unit.batchCount, "lote", "lotes")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setFormError(null); setEditing({ id: unit.id, name: unit.name }) }}
                      aria-label={`Renomear ${unit.name}`}
                    >
                      <Pencil className="h-4 w-4" /> Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger-emphasis hover:bg-danger/10 hover:text-danger-emphasis"
                      disabled={unit.batchCount > 0}
                      title={unit.batchCount > 0 ? "Unidades com lotes não podem ser removidas" : undefined}
                      onClick={() => { setRemoveError(null); setRemoveTarget(unit) }}
                      aria-label={`Remover ${unit.name}`}
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {units?.some((u) => u.batchCount > 0) && (
        <p className="mt-3 text-xs text-muted-foreground">Unidades com lotes não podem ser removidas, para as métricas não perderem a origem. Renomeie quando precisar.</p>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remover ${removeTarget?.name ?? ""}?`}
        description="Os membros vinculados só a esta unidade ficam sem linha e não conseguem aprovar lotes até receberem outra."
        confirmLabel="Remover unidade"
        pendingLabel="Removendo..."
        pending={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </SettingsPanel>
  )
}
