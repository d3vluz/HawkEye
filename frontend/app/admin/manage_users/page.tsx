"use client"

// Equipe: membros com acesso ao HawkEye, cadastro, edição, senha temporária, perfil e remoção.

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Building2, CheckCircle2, KeyRound, Loader2, MapPin, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, Users, type LucideIcon } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { DialogoDeConfirmacao } from "@/components/dialogo-de-confirmacao"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  alterarMembro, criarMembro, listarLinhas, listarMembros, minhaConta, redefinirSenha, removerMembro, resumoDaEquipe, urlDoAvatar,
} from "@/lib/api"
import { acessouHoje, digitosDoTelefone, iniciais, telefone, telefoneCompleto, ultimoAcesso } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { Linha, Membro, ResumoDaEquipe } from "@/types"

const TAMANHO_MINIMO_DA_SENHA = 8
const CABECALHO = "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
const CELULA = "px-6 py-4 text-left align-middle"

interface Formulario {
  nome: string
  matricula: string
  telefone: string
  email: string
  senha: string
  todasAsLinhas: boolean
  linhas: string[]
}

const formularioDe = (membro: Membro | null): Formulario => ({
  nome: membro?.name ?? "",
  matricula: membro?.matricula ?? "",
  telefone: telefone(membro?.phone),
  email: membro?.email ?? "",
  senha: "",
  todasAsLinhas: true,
  linhas: [],
})

const identificacao = ({ matricula, email }: Membro) => [matricula && `Matrícula ${matricula}`, email].filter(Boolean).join(" · ") || "—"

function Pessoa({ membro }: { membro: Membro }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-10 shrink-0">
        {membro.githubUsername && <AvatarImage src={urlDoAvatar(membro.githubUsername)} alt="" />}
        <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">{iniciais(membro.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-foreground">{membro.name}</p>
          {membro.role === "ADMIN" && <Badge variant="outline" className="font-normal text-muted-foreground">Admin</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{identificacao(membro)}</p>
      </div>
    </div>
  )
}

function LinhasDoMembro({ membro }: { membro: Membro }) {
  if (membro.allUnits) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" /> Todas as linhas
      </span>
    )
  }
  if (!membro.units.length) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {membro.units.map((l) => <Badge key={l.id} variant="outline" className="font-normal">{l.name}</Badge>)}
    </div>
  )
}

function MenuDaLinha({ aberto, aoAlternar, children }: { aberto: boolean; aoAlternar: () => void; children: ReactNode }) {
  return (
    <div className="relative flex justify-end">
      <button
        onClick={(e) => { e.stopPropagation(); aoAlternar() }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Ações"
        aria-expanded={aberto}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {aberto && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 z-20 mt-1 w-max rounded-lg border border-border bg-popover p-1 shadow-xl">
          {children}
        </div>
      )}
    </div>
  )
}

function ItemDoMenu({ icone: Icone, aoClicar, perigo, children }: { icone: LucideIcon; aoClicar: () => void; perigo?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={aoClicar}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-muted",
        perigo ? "text-danger-emphasis" : "text-popover-foreground"
      )}
    >
      <Icone className="size-4" /> {children}
    </button>
  )
}

function Campo({ id, rotulo, obrigatorio, dica, children }: { id: string; rotulo: string; obrigatorio?: boolean; dica?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {rotulo} {obrigatorio && <span className="text-danger-emphasis">*</span>}
      </label>
      {children}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

export default function PaginaDaEquipe() {
  const [resumo, setResumo] = useState<ResumoDaEquipe | null>(null)
  const [membros, setMembros] = useState<Membro[] | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [meuId, setMeuId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ficha, setFicha] = useState<Membro | "novo" | null>(null)
  const [formulario, setFormulario] = useState<Formulario>(formularioDe(null))
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null)
  const [trocandoSenha, setTrocandoSenha] = useState<Membro | null>(null)
  const [senhaTemporaria, setSenhaTemporaria] = useState("")
  const [erroDaSenha, setErroDaSenha] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<Membro | null>(null)
  const [erroAoRemover, setErroAoRemover] = useState<string | null>(null)

  const atualizar = async () => {
    const [r, m, l] = await Promise.all([resumoDaEquipe(), listarMembros(), listarLinhas()])
    setResumo(r)
    setMembros(m)
    setLinhas(l)
  }

  useEffect(() => {
    atualizar().catch((e: Error) => { setErro(e.message); setMembros([]) })
    minhaConta().then((m) => setMeuId(m.id)).catch(() => setMeuId(null))
  }, [])

  useEffect(() => {
    if (!menuAberto) return
    const fechar = () => setMenuAberto(null)
    document.addEventListener("click", fechar)
    return () => document.removeEventListener("click", fechar)
  }, [menuAberto])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!membros || !termo) return membros ?? []
    const digitos = digitosDoTelefone(termo)
    return membros.filter((m) =>
      [m.name, m.matricula, m.email].some((v) => v?.toLowerCase().includes(termo)) ||
      (digitos !== "" && !!m.phone && m.phone.includes(digitos))
    )
  }, [membros, busca])

  const editando = ficha !== null && ficha !== "novo" ? ficha : null
  const preencher = (mudanca: Partial<Formulario>) => setFormulario((f) => ({ ...f, ...mudanca }))

  const abrirFicha = (membro: Membro | null) => {
    setFormulario(formularioDe(membro))
    setErroDoFormulario(null)
    setFicha(membro ?? "novo")
  }

  const executar = async (acao: () => Promise<unknown>, aoConcluir: () => void, aoFalhar: (mensagem: string) => void) => {
    setEnviando(true)
    try {
      await acao()
      aoConcluir()
      await atualizar()
    } catch (e) {
      aoFalhar((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const salvarFicha = () => {
    const nome = formulario.nome.trim()
    const fone = digitosDoTelefone(formulario.telefone)
    const email = formulario.email.trim()
    const falha = (() => {
      if (!nome) return "Informe o nome."
      if (fone && !telefoneCompleto(fone)) return "Informe o telefone com DDD, com 10 ou 11 dígitos."
      if (editando) return null
      if (!formulario.matricula.trim()) return "Informe a matrícula."
      if (formulario.senha.length < TAMANHO_MINIMO_DA_SENHA) return `A senha temporária precisa ter ao menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`
      if (!formulario.todasAsLinhas && formulario.linhas.length === 0) return "Selecione ao menos uma linha ou marque “Todas as linhas”."
      return null
    })()
    if (falha) return setErroDoFormulario(falha)

    setErroDoFormulario(null)
    const acao = editando
      ? () => alterarMembro(editando.id, { name: nome, phone: fone || null, email: email || null })
      : () => criarMembro({
          name: nome,
          matricula: formulario.matricula.trim(),
          phone: fone || undefined,
          email: email || undefined,
          temporaryPassword: formulario.senha,
          allUnits: formulario.todasAsLinhas,
          unitIds: formulario.todasAsLinhas ? [] : formulario.linhas,
        })
    executar(acao, () => setFicha(null), setErroDoFormulario)
  }

  const salvarSenha = () => {
    if (!trocandoSenha) return
    if (senhaTemporaria.length < TAMANHO_MINIMO_DA_SENHA) return setErroDaSenha(`Use ao menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`)
    setErroDaSenha(null)
    executar(() => redefinirSenha(trocandoSenha.id, senhaTemporaria), () => setTrocandoSenha(null), setErroDaSenha)
  }

  const alternarPerfil = (membro: Membro) => {
    setMenuAberto(null)
    executar(() => alterarMembro(membro.id, { role: membro.role === "ADMIN" ? "EMPLOYEE" : "ADMIN" }), () => undefined, setErro)
  }

  if (!membros) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-12 animate-spin text-signal" aria-label="Carregando equipe" />
      </div>
    )
  }

  const totais = [
    { rotulo: "Membros", valor: resumo?.members ?? 0, icone: Users },
    { rotulo: "Linhas", valor: resumo?.units ?? 0, icone: Building2 },
    { rotulo: "Ativos hoje", valor: resumo?.activeToday ?? 0, icone: CheckCircle2 },
  ]

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <Cabecalho trilha={[{ rotulo: "Admin", href: "/admin" }, { rotulo: "Equipe" }]} titulo="Equipe" descricao="Gerencie quem tem acesso ao HawkEye." />

      {erro && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger-emphasis">{erro}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {totais.map(({ rotulo, valor, icone: Icone }) => (
          <div key={rotulo} className="flex items-start justify-between rounded-lg border border-l-4 border-border border-l-signal bg-card p-6">
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums">{valor}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{rotulo}</p>
            </div>
            <Icone className="size-7 text-signal" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar nome, matrícula ou contato" aria-label="Buscar membros" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-9 sm:w-80" />
          </div>
          <Button onClick={() => abrirFicha(null)}><Plus className="size-4" /> Adicionar funcionário</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed text-sm">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[17%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className={CABECALHO}>Pessoa</th>
                <th className={CABECALHO}>Telefone</th>
                <th className={CABECALHO}>Linhas</th>
                <th className={CABECALHO}>Último acesso</th>
                <th className="px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((m) => (
                <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                  <td className={CELULA}><Pessoa membro={m} /></td>
                  <td className={cn(CELULA, "whitespace-nowrap text-muted-foreground tabular-nums")}>{telefone(m.phone) || "—"}</td>
                  <td className={CELULA}><LinhasDoMembro membro={m} /></td>
                  <td className={CELULA}>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={cn("size-2 rounded-full", acessouHoje(m.lastAccessAt) ? "bg-success" : "bg-muted-foreground/40")} />
                      {ultimoAcesso(m.lastAccessAt)}
                    </span>
                  </td>
                  <td className={CELULA}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirFicha(m)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Editar ${m.name}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      {m.id === meuId ? (
                        <span className="w-7 text-center text-xs text-muted-foreground">Você</span>
                      ) : (
                        <MenuDaLinha aberto={menuAberto === m.id} aoAlternar={() => setMenuAberto(menuAberto === m.id ? null : m.id)}>
                          <ItemDoMenu icone={KeyRound} aoClicar={() => { setMenuAberto(null); setSenhaTemporaria(""); setErroDaSenha(null); setTrocandoSenha(m) }}>
                            {m.hasPassword ? "Redefinir senha" : "Definir senha"}
                          </ItemDoMenu>
                          <ItemDoMenu icone={ShieldCheck} aoClicar={() => alternarPerfil(m)}>
                            {m.role === "ADMIN" ? "Tornar funcionário" : "Tornar administrador"}
                          </ItemDoMenu>
                          <ItemDoMenu icone={Trash2} perigo aoClicar={() => { setMenuAberto(null); setErroAoRemover(null); setRemovendo(m) }}>
                            Remover da equipe
                          </ItemDoMenu>
                        </MenuDaLinha>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={ficha !== null} onOpenChange={(aberta) => { if (!aberta) setFicha(null) }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editando ? "Editar registro" : "Adicionar funcionário"}</SheetTitle>
            <SheetDescription>
              {editando ? "Atualize os dados de contato desta pessoa." : "A pessoa entra com a senha temporária e cria a própria no primeiro acesso."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4">
            <Campo id="nome-do-membro" rotulo="Nome" obrigatorio>
              <Input id="nome-do-membro" value={formulario.nome} onChange={(e) => preencher({ nome: e.target.value })} placeholder="Nome da pessoa" />
            </Campo>
            <Campo id="matricula-do-membro" rotulo="Matrícula" obrigatorio={!editando} dica={editando ? "A matrícula não pode ser alterada." : undefined}>
              <Input id="matricula-do-membro" value={formulario.matricula} disabled={editando !== null} onChange={(e) => preencher({ matricula: e.target.value })} placeholder="Ex.: 1001" />
            </Campo>
            <Campo id="telefone-do-membro" rotulo="Telefone">
              <Input
                id="telefone-do-membro"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={formulario.telefone}
                onChange={(e) => preencher({ telefone: telefone(e.target.value) })}
                placeholder="(11) 91234-5678"
              />
            </Campo>
            <Campo id="email-do-membro" rotulo="E-mail">
              <Input id="email-do-membro" type="email" value={formulario.email} onChange={(e) => preencher({ email: e.target.value })} placeholder="pessoa@empresa.com" />
            </Campo>

            {!editando && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Linhas</p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" className="size-4 accent-primary" checked={formulario.todasAsLinhas} onChange={(e) => preencher({ todasAsLinhas: e.target.checked })} />
                    Todas as linhas
                  </label>
                  {!formulario.todasAsLinhas && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {linhas.map((l) => {
                        const marcada = formulario.linhas.includes(l.id)
                        return (
                          <button
                            key={l.id}
                            type="button"
                            aria-pressed={marcada}
                            onClick={() => preencher({ linhas: marcada ? formulario.linhas.filter((id) => id !== l.id) : [...formulario.linhas, l.id] })}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs transition-colors",
                              marcada ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {l.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Campo id="senha-do-membro" rotulo="Senha temporária" obrigatorio dica={`Use ao menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}>
                  <Input id="senha-do-membro" type="text" autoComplete="off" value={formulario.senha} onChange={(e) => preencher({ senha: e.target.value })} />
                </Campo>
              </>
            )}

            {erroDoFormulario && <p role="alert" className="text-sm text-danger-emphasis">{erroDoFormulario}</p>}
          </div>

          <SheetFooter>
            <Button onClick={salvarFicha} disabled={enviando}>
              {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Adicionar funcionário"}
            </Button>
            <Button variant="outline" onClick={() => setFicha(null)} disabled={enviando}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={trocandoSenha !== null} onOpenChange={(aberta) => { if (!aberta) setTrocandoSenha(null) }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Definir senha temporária</SheetTitle>
            <SheetDescription>
              {trocandoSenha?.name} entra com esta senha e cria a própria no primeiro acesso. Sessões abertas dessa pessoa serão encerradas.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 px-4">
            <Campo id="senha-temporaria" rotulo="Senha temporária" obrigatorio>
              <Input id="senha-temporaria" type="text" autoComplete="off" value={senhaTemporaria} onChange={(e) => setSenhaTemporaria(e.target.value)} />
            </Campo>
            {erroDaSenha && <p role="alert" className="text-sm text-danger-emphasis">{erroDaSenha}</p>}
          </div>
          <SheetFooter>
            <Button onClick={salvarSenha} disabled={enviando}>{enviando ? "Salvando..." : "Salvar senha"}</Button>
            <Button variant="outline" onClick={() => setTrocandoSenha(null)} disabled={enviando}>Cancelar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DialogoDeConfirmacao
        aberto={removendo !== null}
        titulo={`Remover ${removendo?.name ?? ""} da equipe?`}
        descricao="A pessoa perde o acesso imediatamente. As coletas já feitas continuam no sistema e nas métricas."
        confirmar="Remover da equipe"
        confirmando="Removendo..."
        enviando={enviando}
        erro={erroAoRemover}
        aoConfirmar={() => removendo && executar(() => removerMembro(removendo.id), () => setRemovendo(null), setErroAoRemover)}
        aoCancelar={() => setRemovendo(null)}
      />
    </div>
  )
}
