"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LayoutDashboard, Users, Package, Settings, LogOut, X, Sun, Moon} from "lucide-react"
import { cn } from "@/lib/utils"

const SIDEBAR_ANIM_MS = 300

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExpanded, setShowExpanded] = useState(true)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (sidebarOpen) {
      const t = setTimeout(() => setShowExpanded(true), SIDEBAR_ANIM_MS)
      return () => clearTimeout(t)
    }
    setShowExpanded(false)
  }, [sidebarOpen])

  const handleLogout = () => {
    router.push("/")
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: Package, label: "Lotes", href: "/admin/batches" },
    { icon: Users, label: "Equipe", href: "/admin/manage_users" },
    { icon: Settings, label: "Configurações", href: "/admin/settings" },
  ]

  // @TODO: Dados do usuário admin (futuramente virá do backend)
  const adminUser = {
    name: "Evandro Luz",
    username: "@d3vluz",
    role: "Administrador",
    avatar: "https://github.com/d3vluz.png"
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col overflow-hidden",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo e Perfil */}
        <div className="flex-shrink-0">
          {/* Logo App */}
          <div className={cn(
            "flex h-16 items-center",
            showExpanded ? "justify-between px-4" : "justify-center"
          )}>
            {showExpanded ? (
              <>
                <div className="flex items-center gap-2 py-4">
                  <Image
                    src="/logo.png"
                    alt="HawkEye Logo"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                  <h1 className="text-xl font-bold">HawkEye</h1>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <X className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <div
                className="h-10 w-10 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center"
                onClick={() => setSidebarOpen(true)}
              >
                <Image
                  src="/logo.png"
                  alt="HawkEye Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
            )}
          </div>

          {/* Divisória */}
          {showExpanded && (
            <div className="px-4">
              <div className="h-px bg-sidebar-border" />
            </div>
          )}

          {/* Perfil do Admin */}
          {showExpanded && (
            <div className="px-4 py-4 flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-sidebar-border">
                <AvatarImage src={adminUser.avatar} alt={adminUser.name} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                  {adminUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {adminUser.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {adminUser.role}
                </p>
                <p className="text-xs text-sidebar-foreground/50 truncate">
                  {adminUser.username}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divisória */}
        {showExpanded && (
          <div className="px-4">
            <div className="h-px bg-sidebar-border" />
          </div>
        )}

        {/* Menu Items */}
        <nav className="flex flex-col gap-2 p-4 flex-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                  showExpanded ? "gap-3 px-3" : "justify-center px-0",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {showExpanded && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Footer Actions (Theme + Logout) */}
        <div className="p-4 border-t border-sidebar-border space-y-2">

          {/* Botão de Tema */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={cn(
                "flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                showExpanded ? "gap-3 px-3" : "justify-center px-0"
              )}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Moon className="h-5 w-5 flex-shrink-0" />
              )}
              {showExpanded && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
            </button>
          )}

          {/* Botão de Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              showExpanded ? "gap-3 px-3" : "justify-center px-0"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {showExpanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
