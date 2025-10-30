"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    router.push("/")
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: Package, label: "Lotes", href: "/admin/batches" },
    { icon: Users, label: "Usuários", href: "/admin/manage_users" },
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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-gray-900 text-white transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo e Perfil */}
        <div className="flex-shrink-0">
          {/* Logo App */}
          <div className="flex h-16 items-center justify-between px-4">
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-2 py-4">
                    <Image
                      src="/logo.png"
                      alt="HawkEye Logo"
                      width={64}
                      height={64}
                      className="object-contain"
                    />

                    <h1 className={cn(
                      "text-xl font-bold transition-opacity duration-150",
                      sidebarOpen ? "opacity-100 delay-300" : "opacity-0 delay-0"
                    )}>
                      HawkEye
                    </h1>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={cn(
                    "text-gray-400 hover:text-white hover:bg-gray-800 transition-opacity duration-150",
                    sidebarOpen ? "opacity-100 delay-300" : "opacity-0 delay-0"
                  )}
                >
                  <X className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <div 
                className="h-12 w-12 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Image
                  src="/logo.png"
                  alt="HawkEye Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                />
              </div>
            )}
          </div>

          {/* Divisória */}
          {sidebarOpen && (
            <div className="px-4">
              <div className="h-px bg-gray-800" />
            </div>
          )}

          {/* Perfil do Admin */}
          {sidebarOpen && (
            <div className="px-4 py-4 flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-gray-700">
                <AvatarImage src={adminUser.avatar} alt={adminUser.name} />
                <AvatarFallback className="bg-gray-700 text-white text-sm">
                  {adminUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "flex-1 min-w-0 transition-opacity duration-150",
                sidebarOpen ? "opacity-100 delay-300" : "opacity-0 delay-0"
              )}>
                <p className="text-sm font-semibold text-white truncate">
                  {adminUser.name}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {adminUser.role}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {adminUser.username}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divisória */}
        {sidebarOpen && (
          <div className="px-4">
            <div className="h-px bg-gray-800" />
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className={cn(
                    "transition-opacity duration-150",
                    sidebarOpen ? "opacity-100 delay-300" : "opacity-0 delay-0"
                  )}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && (
              <span className={cn(
                "transition-opacity duration-150",
                sidebarOpen ? "opacity-100 delay-300" : "opacity-0 delay-0"
              )}>
                Sair
              </span>
            )}
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