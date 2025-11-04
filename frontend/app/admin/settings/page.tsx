"use client"

import { ChevronRight } from "lucide-react"

export default function ConfiguracoesPage() {
  return (
    <div className="p-8">
      {/* Header com Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 tracking-wider">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3 text-gray-500"/>
          <span className="text-gray-700">CONFIGURAÇÕES</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações</h1>
        <p className="text-gray-600 text-sm">Ajuste parâmetros e configurações pertinentes na aplicação</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-gray-400">
          Essa função será desenvolvida em breve!
        </p>
      </div>
    </div>
  )
}