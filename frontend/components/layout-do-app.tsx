"use client"

// Estrutura das áreas internas: menu lateral recolhível (com o menu de cada perfil), conta, tema e sair.

import { useEffect, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  History, LayoutDashboard, LogOut, Moon, Package, PanelLeftClose, PanelLeftOpen, ScanSearch, Settings, Sun, Users,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { minhaConta, sair, urlDoAvatar } from "@/lib/api"
import { iniciais } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { MembroDaSessao, Perfil } from "@/types"

const LARGURA_COMPACTA = 1024

interface ItemDoMenu {
  icone: LucideIcon
  rotulo: string
  href: string
  ativoEm?: string[]
}

const MENU: Record<Perfil, ItemDoMenu[]> = {
  ADMIN: [
    { icone: LayoutDashboard, rotulo: "Dashboard", href: "/admin" },
    { icone: Package, rotulo: "Lotes", href: "/admin/batches", ativoEm: ["/admin/batches/"] },
    { icone: Users, rotulo: "Equipe", href: "/admin/manage_users" },
    { icone: Settings, rotulo: "Configurações", href: "/admin/settings" },
  ],
  EMPLOYEE: [
    { icone: ScanSearch, rotulo: "Inspeção", href: "/inspecao", ativoEm: ["/results"] },
    { icone: History, rotulo: "Minhas coletas", href: "/coletas", ativoEm: ["/coletas/"] },
  ],
}

const NOME_DO_PERFIL: Record<Perfil, string> = { ADMIN: "Administrador", EMPLOYEE: "Funcionário" }

// Ícones, logo e avatar ficam sempre na mesma coluna; só a largura anima e o
// overflow-hidden da barra revela os textos conforme ela abre, sem pulos.
const ITEM = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors"
const ITEM_INATIVO = "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"

function Texto({ aberto, children, className }: { aberto: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "min-w-0 whitespace-nowrap transition-opacity motion-reduce:transition-none",
        aberto ? "opacity-100 delay-100 duration-200" : "opacity-0 duration-100",
        className
      )}
    >
      {children}
    </span>
  )
}

export function LayoutDoApp({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const caminho = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [aberto, setAberto] = useState(true)
  const [membro, setMembro] = useState<MembroDaSessao | null>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    setMontado(true)
    minhaConta().then(setMembro).catch(() => setMembro(null))
    // Recolhe ao entrar em telas estreitas, inclusive ao redimensionar; reabrir fica a critério do usuário.
    const largo = window.matchMedia(`(min-width: ${LARGURA_COMPACTA}px)`)
    if (!largo.matches) setAberto(false)
    const aoMudar = (evento: MediaQueryListEvent) => { if (!evento.matches) setAberto(false) }
    largo.addEventListener("change", aoMudar)
    return () => largo.removeEventListener("change", aoMudar)
  }, [])

  const identificacao = membro?.githubUsername ? `@${membro.githubUsername}` : membro?.matricula ?? membro?.email
  const escuro = resolvedTheme === "dark"
  const rotuloDoTema = escuro ? "Modo claro" : "Modo escuro"

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none",
          aberto ? "w-64" : "w-16"
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-3">
          <Image src="/logo.png" alt="HawkEye" width={40} height={40} className="size-10 shrink-0 object-contain" />
          <Texto aberto={aberto} className="text-xl font-bold">HawkEye</Texto>
        </div>

        <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

        <div className="flex shrink-0 items-center gap-3 px-3 py-4">
          <Avatar className="size-10 shrink-0 border-2 border-sidebar-border">
            {membro?.githubUsername && <AvatarImage src={urlDoAvatar(membro.githubUsername)} alt="" />}
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">{membro && iniciais(membro.name)}</AvatarFallback>
          </Avatar>
          <Texto aberto={aberto} className="flex-1">
            <span className="block truncate text-sm font-semibold text-sidebar-foreground">{membro?.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{NOME_DO_PERFIL[perfil]}</span>
            <span className="block truncate text-xs text-sidebar-foreground/50">{identificacao}</span>
          </Texto>
        </div>

        <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-2 p-3">
          {MENU[perfil].map((item) => {
            const ativo = caminho === item.href || item.ativoEm?.some((prefixo) => caminho.startsWith(prefixo))
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                title={aberto ? undefined : item.rotulo}
                className={cn(ITEM, ativo ? "bg-sidebar-accent text-sidebar-foreground" : ITEM_INATIVO)}
              >
                <item.icone className="size-5 shrink-0" />
                <Texto aberto={aberto}>{item.rotulo}</Texto>
              </Link>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          <button
            aria-label={aberto ? "Recolher menu" : "Expandir menu"}
            aria-expanded={aberto}
            title={aberto ? undefined : "Expandir menu"}
            onClick={() => setAberto(!aberto)}
            className={cn(ITEM, ITEM_INATIVO)}
          >
            {aberto ? <PanelLeftClose className="size-5 shrink-0" /> : <PanelLeftOpen className="size-5 shrink-0" />}
            <Texto aberto={aberto}>Recolher menu</Texto>
          </button>

          {montado && (
            <button
              aria-label={rotuloDoTema}
              title={aberto ? undefined : rotuloDoTema}
              onClick={() => setTheme(escuro ? "light" : "dark")}
              className={cn(ITEM, ITEM_INATIVO)}
            >
              {escuro ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
              <Texto aberto={aberto}>{rotuloDoTema}</Texto>
            </button>
          )}

          <button aria-label="Sair" title={aberto ? undefined : "Sair"} onClick={sair} className={cn(ITEM, ITEM_INATIVO)}>
            <LogOut className="size-5 shrink-0" />
            <Texto aberto={aberto}>Sair</Texto>
          </button>
        </div>
      </aside>

      <main className={cn("min-h-screen transition-[margin] duration-300 ease-out motion-reduce:transition-none", aberto ? "ml-64" : "ml-16")}>
        {children}
      </main>
    </div>
  )
}
