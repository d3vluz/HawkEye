"use client"

export default function AdminPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Visão geral do sistema</p>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Bem-vindo ao Admin
        </h3>
        <p className="text-gray-600">
          Esta é a primeira versão da interface de administração. Use o menu lateral para navegar entre as diferentes seções.
        </p>
      </div>
    </div>
  )
}