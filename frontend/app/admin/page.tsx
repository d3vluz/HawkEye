"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    router.push("/")
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: Package, label: "Lotes", active: false },
    { icon: Users, label: "Usuários", active: false },
    { icon: Settings, label: "Configurações", active: false },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-gray-900 text-white transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header Sidebar */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          {sidebarOpen && (
            <h1 className="text-xl font-bold">HawkEye Admin</h1>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-2 p-4">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className={cn("transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="p-8">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Bem-vindo ao Admin
            </h3>
            <p className="text-gray-600">
              Esta é a primeira versão da interface de administração.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}