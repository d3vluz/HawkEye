"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LayoutDashboard, Users, Package, Settings, LogOut, Sun, Moon, ScanSearch, History,
  PanelLeftClose, PanelLeftOpen, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { avatarUrl, getMe, logout, type SessionMember } from "@/lib/api-client"

const COMPACT_VIEWPORT = 1024

interface MenuEntry {
  icon: LucideIcon
  label: string
  href: string
  activeOn?: string[]
}

const MENU: Record<SessionMember["role"], MenuEntry[]> = {
  ADMIN: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: Package, label: "Lotes", href: "/admin/batches" },
    { icon: Users, label: "Equipe", href: "/admin/manage_users" },
    { icon: Settings, label: "Configurações", href: "/admin/settings" },
  ],
  EMPLOYEE: [
    { icon: ScanSearch, label: "Inspeção", href: "/inspecao", activeOn: ["/results"] },
    { icon: History, label: "Minhas coletas", href: "/coletas", activeOn: ["/coletas/"] },
  ],
}

const ROLE_LABEL: Record<SessionMember["role"], string> = {
  ADMIN: "Administrador",
  EMPLOYEE: "Funcionário",
}

// Ícones, logo e avatar ficam sempre na mesma coluna; só a largura anima e o
// overflow-hidden da barra revela os textos conforme ela abre, sem pulos.
const ITEM = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors"

function Label({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "min-w-0 whitespace-nowrap transition-opacity motion-reduce:transition-none",
        open ? "opacity-100 duration-200 delay-100" : "opacity-0 duration-100",
        className
      )}
    >
      {children}
    </span>
  )
}

export function AppShell({ role, children }: { role: SessionMember["role"]; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const [member, setMember] = useState<SessionMember | null>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    if (window.innerWidth < COMPACT_VIEWPORT) setOpen(false)
    getMe().then(setMember).catch(console.error)
  }, [])

  const initials = member?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? ''
  const handle = member?.githubUsername ? `@${member.githubUsername}` : member?.matricula ?? member?.email
  const idle = "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none",
          open ? "w-64" : "w-16"
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-3">
          <Image src="/logo.png" alt="HawkEye" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
          <Label open={open} className="text-xl font-bold">HawkEye</Label>
        </div>

        <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

        <div className="flex shrink-0 items-center gap-3 px-3 py-4">
          <Avatar className="h-10 w-10 shrink-0 border-2 border-sidebar-border">
            {member?.githubUsername && <AvatarImage src={avatarUrl(member.githubUsername)} alt="" />}
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">{initials}</AvatarFallback>
          </Avatar>
          <Label open={open} className="flex-1">
            <span className="block truncate text-sm font-semibold text-sidebar-foreground">{member?.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{ROLE_LABEL[role]}</span>
            <span className="block truncate text-xs text-sidebar-foreground/50">{handle}</span>
          </Label>
        </div>

        <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-2 p-3">
          {MENU[role].map((item) => {
            const isActive = pathname === item.href || item.activeOn?.some((prefix) => pathname.startsWith(prefix))
            return (
              <button
                key={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={open ? undefined : item.label}
                onClick={() => router.push(item.href)}
                className={cn(ITEM, isActive ? "bg-sidebar-accent text-sidebar-foreground" : idle)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <Label open={open}>{item.label}</Label>
              </button>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          <button
            aria-label={open ? "Recolher menu" : "Expandir menu"}
            aria-expanded={open}
            title={open ? undefined : "Expandir menu"}
            onClick={() => setOpen(!open)}
            className={cn(ITEM, idle)}
          >
            {open ? <PanelLeftClose className="h-5 w-5 shrink-0" /> : <PanelLeftOpen className="h-5 w-5 shrink-0" />}
            <Label open={open}>Recolher menu</Label>
          </button>

          {mounted && (
            <button
              aria-label={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              title={open ? undefined : theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={cn(ITEM, idle)}
            >
              {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              <Label open={open}>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</Label>
            </button>
          )}

          <button aria-label="Sair" title={open ? undefined : "Sair"} onClick={logout} className={cn(ITEM, idle)}>
            <LogOut className="h-5 w-5 shrink-0" />
            <Label open={open}>Sair</Label>
          </button>
        </div>
      </aside>

      <div className={cn("transition-[margin] duration-300 ease-out motion-reduce:transition-none", open ? "ml-64" : "ml-16")}>
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
