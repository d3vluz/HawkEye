"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ChevronRight, Users, CheckCircle2, Building2,
  Search, Plus, Trash2, MapPin, MoreHorizontal, KeyRound, ShieldCheck, Pencil,
  type LucideIcon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { cn, formatLastAccess, isToday } from "@/lib/utils"
import {
  avatarUrl, createMember, deleteMember, getMe, getMembers, getTeamOverview, getUnits,
  resetMemberPassword, updateMember, updateMemberRole,
  type Member, type Unit, type TeamOverview,
} from "@/lib/api-client"

const MIN_PASSWORD_LENGTH = 8

function initials(name: string): string {
  return name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

function identity({ matricula, email }: Pick<Member, "matricula" | "email">): string {
  return [matricula && `Matrícula ${matricula}`, email].filter(Boolean).join(" · ") || "—"
}

function matches(query: string, ...values: Array<string | null>): boolean {
  return values.some((value) => value?.toLowerCase().includes(query))
}

function Person({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-10 w-10 shrink-0">
        {member.githubUsername && <AvatarImage src={avatarUrl(member.githubUsername)} alt="" />}
        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold truncate text-foreground">{member.name}</p>
          {member.role === "ADMIN" && <Badge variant="outline" className="font-normal text-muted-foreground">Admin</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{identity(member)}</p>
      </div>
    </div>
  )
}

function unitsLabel(allUnits: boolean, units: Unit[]) {
  if (allUnits) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" /> Todas as unidades
      </span>
    )
  }
  if (!units.length) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {units.map((u) => (
        <Badge key={u.id} variant="outline" className="font-normal">{u.name}</Badge>
      ))}
    </div>
  )
}

function RowMenu({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="relative flex justify-end">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Ações"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-max rounded-lg border border-border bg-popover p-1 shadow-xl"
        >
          {children}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, onClick, danger, children }: { icon: LucideIcon; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
        danger ? "text-danger-emphasis" : "text-popover-foreground"
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  )
}

function FormField({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-danger-emphasis">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const TH = "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
const TD = "px-6 py-4 text-left align-middle"

export default function TeamPage() {
  const [overview, setOverview] = useState<TeamOverview | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // formulário de criação e edição
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [formName, setFormName] = useState("")
  const [formMatricula, setFormMatricula] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formAllUnits, setFormAllUnits] = useState(true)
  const [formUnitIds, setFormUnitIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const refresh = async () => {
    const [o, m, u] = await Promise.all([getTeamOverview(), getMembers(), getUnits()])
    setOverview(o); setMembers(m); setUnits(u)
  }

  useEffect(() => {
    refresh().catch(console.error).finally(() => setLoading(false))
    getMe().then((member) => setCurrentMemberId(member.id)).catch(console.error)
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [openMenu])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => matches(q, m.name, m.matricula, m.email, m.phone))
  }, [members, search])

  const openSheet = (member: Member | null) => {
    setEditing(member)
    setFormName(member?.name ?? ""); setFormMatricula(member?.matricula ?? "")
    setFormPhone(member?.phone ?? ""); setFormEmail(member?.email ?? "")
    setFormPassword(""); setFormAllUnits(true); setFormUnitIds([]); setFormError(null)
    setSheetOpen(true)
  }

  const toggleUnit = (id: string) => {
    setFormUnitIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]))
  }

  const saveForm = async () => {
    const name = formName.trim()
    const phone = formPhone.trim()
    const email = formEmail.trim()

    if (!name) throw new Error("Informe o nome.")
    if (editing) return updateMember(editing.id, { name, phone: phone || null, email: email || null })

    if (!formMatricula.trim()) throw new Error("Informe a matrícula.")
    if (formPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha temporária precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    if (!formAllUnits && formUnitIds.length === 0) throw new Error("Selecione ao menos uma unidade ou marque “Todas as unidades”.")

    return createMember({
      name,
      matricula: formMatricula.trim(),
      phone: phone || undefined,
      email: email || undefined,
      temporaryPassword: formPassword,
      allUnits: formAllUnits,
      unitIds: formAllUnits ? [] : formUnitIds,
    })
  }

  const submitForm = async () => {
    setFormError(null)
    setSubmitting(true)
    try {
      await saveForm()
      setSheetOpen(false)
      await refresh()
    } catch (error) {
      setFormError((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const openPasswordSheet = (member: Member) => {
    setOpenMenu(null); setTemporaryPassword(""); setPasswordError(null)
    setPasswordTarget(member)
  }

  const submitPassword = async () => {
    if (!passwordTarget) return
    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) return setPasswordError(`Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    setPasswordError(null)
    setSubmitting(true)
    try {
      await resetMemberPassword(passwordTarget.id, temporaryPassword)
      setPasswordTarget(null)
      await refresh()
    } catch (error) {
      setPasswordError((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleRole = async (member: Member) => {
    setOpenMenu(null)
    try {
      await updateMemberRole(member.id, member.role === "ADMIN" ? "EMPLOYEE" : "ADMIN")
      await refresh()
    } catch (error) {
      console.error(error)
    }
  }

  const askRemoval = (member: Member) => {
    setOpenMenu(null); setRemoveError(null)
    setRemoveTarget(member)
  }

  const confirmRemoval = async () => {
    if (!removeTarget) return
    setSubmitting(true)
    try {
      await deleteMember(removeTarget.id)
      setRemoveTarget(null)
      await refresh()
    } catch (error) {
      setRemoveError((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const metrics = [
    { label: "Membros", value: overview?.members ?? 0, icon: Users },
    { label: "Unidades", value: overview?.units ?? 0, icon: Building2 },
    { label: "Ativos hoje", value: overview?.activeToday ?? 0, icon: CheckCircle2 },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-border border-t-signal rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Carregando equipe...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Breadcrumb + título */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 tracking-wider">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3" />
          <span>EQUIPE E OPERAÇÃO</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">MEMBROS</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Membros</h1>
        <p className="text-muted-foreground text-sm">Gerencie quem tem acesso ao HawkEye.</p>
      </div>

      {/* Cards de métrica */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-card border border-border border-l-4 border-l-signal rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">{m.value}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{m.label}</p>
                </div>
                <Icon className="w-7 h-7 text-signal" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Painel: busca + tabela */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, matrícula ou contato"
              aria-label="Buscar membros"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-80"
            />
          </div>
          <Button onClick={() => openSheet(null)}><Plus className="h-4 w-4" /> Adicionar funcionário</Button>
        </div>

        <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "36%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className={TH}>Pessoa</th>
                <th className={TH}>Telefone</th>
                <th className={TH}>Unidades</th>
                <th className={TH}>Último acesso</th>
                <th className="px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30">
                  <td className={TD}><Person member={m} /></td>
                  <td className={cn(TD, "text-muted-foreground tabular-nums")}>{m.phone || "—"}</td>
                  <td className={TD}>{unitsLabel(m.allUnits, m.units)}</td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", isToday(m.lastAccessAt) ? "bg-success" : "bg-muted-foreground/40")} />
                      {formatLastAccess(m.lastAccessAt)}
                    </span>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openSheet(m)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Editar ${m.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {m.id === currentMemberId ? (
                        <span className="w-7 text-center text-xs text-muted-foreground">Você</span>
                      ) : (
                        <RowMenu open={openMenu === m.id} onToggle={() => setOpenMenu(openMenu === m.id ? null : m.id)}>
                          <MenuItem icon={KeyRound} onClick={() => openPasswordSheet(m)}>
                            {m.hasPassword ? "Redefinir senha" : "Definir senha"}
                          </MenuItem>
                          <MenuItem icon={ShieldCheck} onClick={() => toggleRole(m)}>
                            {m.role === "ADMIN" ? "Tornar funcionário" : "Tornar administrador"}
                          </MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => askRemoval(m)}>
                            Remover da equipe
                          </MenuItem>
                        </RowMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>
              )}
            </tbody>
        </table>
      </div>

      {/* Sheet: adicionar ou editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar registro" : "Adicionar funcionário"}</SheetTitle>
            <SheetDescription>
              {editing ? "Atualize os dados de contato desta pessoa." : "A pessoa entra com a senha temporária e cria a própria no primeiro acesso."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-5">
            <FormField id="member-name" label="Nome" required>
              <Input id="member-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome da pessoa" />
            </FormField>
            <FormField id="member-matricula" label="Matrícula" required={!editing} hint={editing ? "A matrícula não pode ser alterada." : undefined}>
              <Input id="member-matricula" value={formMatricula} disabled={editing !== null} onChange={(e) => setFormMatricula(e.target.value)} placeholder="Ex.: 1001" />
            </FormField>
            <FormField id="member-phone" label="Telefone">
              <Input id="member-phone" type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 91234-5678" />
            </FormField>
            <FormField id="member-email" label="E-mail">
              <Input id="member-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </FormField>

            {!editing && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Unidades</p>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input type="checkbox" className="accent-primary h-4 w-4" checked={formAllUnits} onChange={(e) => setFormAllUnits(e.target.checked)} />
                    Todas as unidades
                  </label>
                  {!formAllUnits && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {units.map((u) => {
                        const on = formUnitIds.includes(u.id)
                        return (
                          <button key={u.id} type="button" aria-pressed={on} onClick={() => toggleUnit(u.id)}
                            className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
                              on ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground hover:bg-muted")}>
                            {u.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <FormField id="member-password" label="Senha temporária" required hint={`Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
                  <Input id="member-password" type="text" autoComplete="off" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
                </FormField>
              </>
            )}

            {formError && <p role="alert" className="text-sm text-danger-emphasis">{formError}</p>}
          </div>

          <SheetFooter>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar funcionário"}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={submitting}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet: senha temporária */}
      <Sheet open={passwordTarget !== null} onOpenChange={(open) => { if (!open) setPasswordTarget(null) }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Definir senha temporária</SheetTitle>
            <SheetDescription>
              {passwordTarget?.name} entra com esta senha e cria a própria no primeiro acesso. Sessões abertas dessa pessoa serão encerradas.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 px-4">
            <label htmlFor="temporary-password" className="text-sm font-medium text-foreground">Senha temporária <span className="text-danger-emphasis">*</span></label>
            <Input id="temporary-password" type="text" autoComplete="off" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} />
            {passwordError && <p role="alert" className="text-sm text-danger-emphasis">{passwordError}</p>}
          </div>
          <SheetFooter>
            <Button onClick={submitPassword} disabled={submitting}>{submitting ? "Salvando..." : "Salvar senha"}</Button>
            <Button variant="outline" onClick={() => setPasswordTarget(null)} disabled={submitting}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remover ${removeTarget?.name ?? ""} da equipe?`}
        description="A pessoa perde o acesso imediatamente. As coletas já feitas continuam no sistema e nas métricas."
        confirmLabel="Remover da equipe"
        pendingLabel="Removendo..."
        pending={submitting}
        error={removeError}
        onConfirm={confirmRemoval}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
