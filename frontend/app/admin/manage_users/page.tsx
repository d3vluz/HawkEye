"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ChevronRight, Users, CheckCircle2, Mail, Building2,
  Search, Plus, Trash2, Check, Send, X, MapPin, MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { cn, formatLastAccess, isToday } from "@/lib/utils"
import {
  getTeamOverview, getMembers, getInvites, getUnits,
  createInvite, createMember, acceptInvite, resendInvite, cancelInvite, deleteMember,
  type Member, type Invite, type Unit, type TeamOverview,
} from "@/lib/api-client"

type Accent = "signal" | "success"

const accent: Record<Accent, { border: string; icon: string }> = {
  signal: { border: "border-l-signal", icon: "text-signal" },
  success: { border: "border-l-success", icon: "text-success-emphasis" },
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

function Person({ name, email, muted }: { name: string; email: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className={cn("font-semibold truncate", muted ? "text-muted-foreground" : "text-foreground")}>{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
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

const inviteStatus: Record<Invite["status"], { label: string; dot: string; cls: string }> = {
  PENDING: { label: "Pendente", dot: "bg-warning", cls: "border-warning/30 bg-warning/10 text-warning-emphasis" },
  ACCEPTED: { label: "Aceito", dot: "bg-success", cls: "border-success/30 bg-success/10 text-success-emphasis" },
  CANCELLED: { label: "Cancelado", dot: "bg-muted-foreground", cls: "border-border bg-muted text-muted-foreground" },
}

function StatusBadge({ status }: { status: Invite["status"] }) {
  const s = inviteStatus[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
    </span>
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
          className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-xl"
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
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
        danger ? "text-danger-emphasis" : "text-popover-foreground"
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  )
}

// Larguras fixas e iguais nas duas abas — evita o conteúdo "dançar" ao trocar de aba.
function TeamCols() {
  return (
    <colgroup>
      <col style={{ width: "42%" }} />
      <col style={{ width: "28%" }} />
      <col style={{ width: "22%" }} />
      <col style={{ width: "8%" }} />
    </colgroup>
  )
}

const TH = "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
const TD = "px-6 py-4 text-left align-middle"

export default function TeamPage() {
  const [overview, setOverview] = useState<TeamOverview | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // formulário do sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [asMember, setAsMember] = useState(false)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAllUnits, setFormAllUnits] = useState(true)
  const [formUnitIds, setFormUnitIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    const [o, m, i, u] = await Promise.all([getTeamOverview(), getMembers(), getInvites(), getUnits()])
    setOverview(o); setMembers(m); setInvites(i); setUnits(u)
  }

  useEffect(() => {
    refresh().catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [openMenu])

  const pendingInvites = useMemo(() => invites.filter((i) => i.status === "PENDING"), [invites])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, search])

  // Só convites pendentes aparecem na aba — aceitos/cancelados saem da lista.
  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pendingInvites
    return pendingInvites.filter((i) => i.email.toLowerCase().includes(q) || (i.name ?? "").toLowerCase().includes(q))
  }, [pendingInvites, search])

  const openSheet = () => {
    setAsMember(false); setFormName(""); setFormEmail("")
    setFormAllUnits(true); setFormUnitIds([]); setFormError(null)
    setSheetOpen(true)
  }

  const toggleUnit = (id: string) => {
    setFormUnitIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]))
  }

  const submitForm = async () => {
    setFormError(null)
    if (!formEmail.trim()) return setFormError("Informe um e-mail.")
    if (asMember && !formName.trim()) return setFormError("Nome é obrigatório para adicionar um membro direto.")
    if (!formAllUnits && formUnitIds.length === 0) return setFormError("Selecione ao menos uma unidade ou marque “Todas as unidades”.")

    const payload = {
      name: formName.trim() || undefined,
      email: formEmail.trim(),
      allUnits: formAllUnits,
      unitIds: formAllUnits ? [] : formUnitIds,
    }
    setSubmitting(true)
    try {
      if (asMember) await createMember(payload)
      else await createInvite(payload)
      setSheetOpen(false)
      await refresh()
    } catch {
      setFormError("Não foi possível salvar. Verifique os dados (e-mail já pode existir).")
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setOpenMenu(null)
    setBusy(key)
    try { await fn(); await refresh() } catch (e) { console.error(e) } finally { setBusy(null) }
  }

  const metrics = [
    { label: "Membros", value: overview?.members ?? 0, icon: Users, accent: "signal" as Accent },
    { label: "Convites pendentes", value: overview?.pendingInvites ?? 0, icon: Mail, accent: "signal" as Accent },
    { label: "Unidades", value: overview?.units ?? 0, icon: Building2, accent: "signal" as Accent },
    { label: "Ativos hoje", value: overview?.activeToday ?? 0, icon: CheckCircle2, accent: "signal" as Accent },
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

  const countBadge = "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold bg-muted text-muted-foreground group-data-[state=active]:bg-foreground group-data-[state=active]:text-background"

  return (
    <div className="p-8">
      {/* Breadcrumb + título */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 tracking-wider">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3" />
          <span>EQUIPE E OPERAÇÃO</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">MEMBROS E CONVITES</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Membros e Convites</h1>
        <p className="text-muted-foreground text-sm">Gerencie quem tem acesso ao HawkEye e os convites pendentes.</p>
      </div>

      {/* Cards de métrica */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => {
          const Icon = m.icon
          const a = accent[m.accent]
          return (
            <div key={m.label} className={cn("bg-card border border-border border-l-4 rounded-lg p-6", a.border)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">{m.value}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{m.label}</p>
                </div>
                <Icon className={cn("w-7 h-7", a.icon)} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Painel unificado: abas + busca + tabela */}
      <div className="rounded-xl border border-border bg-card">
        <Tabs defaultValue="members">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="members" className="group">Membros<span className={countBadge}>{members.length}</span></TabsTrigger>
              <TabsTrigger value="invites" className="group">Convites<span className={countBadge}>{pendingInvites.length}</span></TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou e-mail"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button onClick={openSheet}><Plus className="h-4 w-4" /> Convidar</Button>
            </div>
          </div>

          {/* Aba Membros */}
          <TabsContent value="members" className="m-0">
            <table className="w-full table-fixed text-sm">
              <TeamCols />
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={TH}>Pessoa</th>
                  <th className={TH}>Unidades</th>
                  <th className={TH}>Último acesso</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30">
                    <td className={TD}><Person name={m.name} email={m.email} /></td>
                    <td className={TD}>{unitsLabel(m.allUnits, m.units)}</td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={cn("h-2 w-2 rounded-full", isToday(m.lastAccessAt) ? "bg-success" : "bg-muted-foreground/40")} />
                        {formatLastAccess(m.lastAccessAt)}
                      </span>
                    </td>
                    <td className={TD}>
                      <RowMenu open={openMenu === m.id} onToggle={() => setOpenMenu(openMenu === m.id ? null : m.id)}>
                        <MenuItem icon={Trash2} danger
                          onClick={() => { if (confirm(`Remover ${m.name} da equipe?`)) act(`del-${m.id}`, () => deleteMember(m.id)); else setOpenMenu(null) }}>
                          Remover da equipe
                        </MenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </TabsContent>

          {/* Aba Convites (apenas pendentes) */}
          <TabsContent value="invites" className="m-0">
            <table className="w-full table-fixed text-sm">
              <TeamCols />
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={TH}>Pessoa</th>
                  <th className={TH}>Unidades</th>
                  <th className={TH}>Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30">
                    <td className={TD}><Person name={inv.name || inv.email} email={inv.email} muted={!inv.name} /></td>
                    <td className={TD}>{unitsLabel(inv.allUnits, inv.units)}</td>
                    <td className={TD}><StatusBadge status={inv.status} /></td>
                    <td className={TD}>
                      <RowMenu open={openMenu === inv.id} onToggle={() => setOpenMenu(openMenu === inv.id ? null : inv.id)}>
                        <MenuItem icon={Check} onClick={() => act(`acc-${inv.id}`, () => acceptInvite(inv.id))}>Aceitar convite</MenuItem>
                        <MenuItem icon={Send} onClick={() => act(`res-${inv.id}`, () => resendInvite(inv.id))}>Reenviar</MenuItem>
                        <MenuItem icon={X} danger onClick={() => act(`can-${inv.id}`, () => cancelInvite(inv.id))}>Cancelar</MenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ))}
                {filteredInvites.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Nenhum convite pendente.</td></tr>
                )}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheet: Convidar / Adicionar membro */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{asMember ? "Adicionar membro" : "Convidar para a equipe"}</SheetTitle>
            <SheetDescription>
              {asMember
                ? "O membro é criado direto, já com acesso."
                : "Cria um convite pendente. Ao aceitar, vira membro."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome {asMember && <span className="text-danger-emphasis">*</span>}</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome da pessoa" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">E-mail <span className="text-danger-emphasis">*</span></label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Unidades</label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" className="accent-primary h-4 w-4" checked={formAllUnits} onChange={(e) => setFormAllUnits(e.target.checked)} />
                Todas as unidades
              </label>
              {!formAllUnits && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {units.map((u) => {
                    const on = formUnitIds.includes(u.id)
                    return (
                      <button key={u.id} type="button" onClick={() => toggleUnit(u.id)}
                        className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
                          on ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground hover:bg-muted")}>
                        {u.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer border-t border-border pt-4">
              <input type="checkbox" className="accent-primary h-4 w-4" checked={asMember} onChange={(e) => setAsMember(e.target.checked)} />
              Criar como membro direto (sem convite)
            </label>

            {formError && <p className="text-sm text-danger-emphasis">{formError}</p>}
          </div>

          <SheetFooter>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? "Salvando..." : asMember ? "Adicionar membro" : "Enviar convite"}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={submitting}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
