"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Search, Eye, Download, ChevronDown, ChevronRight } from "lucide-react"

export default function LotesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const batches = [
    { 
      id: "1", 
      batchId: "L-2024-001", 
      name: "Lote Inspeção Industrial 001", 
      status: "completed",
      images: 245,
      size: "1.2 GB",
      date: "2024-01-15"
    },
    { 
      id: "2", 
      batchId: "L-2024-002", 
      name: "Lote Inspeção Industrial 002", 
      status: "completed",
      images: 189,
      size: "890 MB",
      date: "2024-01-14"
    },
    { 
      id: "3", 
      batchId: "L-2024-003", 
      name: "Lote Inspeção Industrial 003", 
      status: "pending",
      images: 156,
      size: "756 MB",
      date: "2024-01-13"
    },
    { 
      id: "4", 
      batchId: "L-2024-004", 
      name: "Lote Inspeção Industrial 004", 
      status: "completed",
      images: 312,
      size: "1.5 GB",
      date: "2024-01-12"
    },
    { 
      id: "5", 
      batchId: "L-2024-005", 
      name: "Lote Inspeção Industrial 005", 
      status: "failed",
      images: 45,
      size: "234 MB",
      date: "2024-01-11"
    },
    { 
      id: "6", 
      batchId: "L-2024-006", 
      name: "Lote Inspeção Industrial 006", 
      status: "completed",
      images: 98,
      size: "445 MB",
      date: "2024-01-10"
    },
    { 
      id: "7", 
      batchId: "L-2024-007", 
      name: "Lote Inspeção Industrial 007", 
      status: "completed",
      images: 567,
      size: "2.3 GB",
      date: "2024-01-09"
    },
    { 
      id: "8", 
      batchId: "L-2024-008", 
      name: "Lote Inspeção Industrial 008", 
      status: "pending",
      images: 78,
      size: "389 MB",
      date: "2024-01-08"
    },
  ]

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: "bg-green-50 text-green-700 border border-green-200",
      pending: "bg-yellow-50 text-yellow-700 border border-yellow-200",
      failed: "bg-red-50 text-red-700 border border-red-200"
    }
    const labels = {
      completed: "concluído",
      pending: "pendente",
      failed: "falhou"
    }
    return (
      <span className={`px-2.5 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.batchId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || batch.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      {/* Header com Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 tracking-wider">
          <span>ADMIN</span>
          <ChevronRight className="h-3 w-3 text-gray-500"/>
          <span className="text-gray-700">LOTES</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciamento de Lotes</h1>
        <p className="text-gray-600 text-sm">Visualize e gerencie todos os lotes de imagens processados pelo sistema</p>
      </div>

      {/* Table Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {/* Table Header com Search e Filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Todos os Lotes</h2>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar lotes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="failed">Falhos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Wrapper com Scroll Horizontal */}
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-700 text-xs w-[130px] pl-6">ID do Lote</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[280px]">Nome</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[130px] text-center">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[100px] text-center">Imagens</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[110px] text-center">Tamanho</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[120px] text-center">Data</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[100px] text-center pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow 
                    key={batch.id} 
                    className="hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <TableCell className="font-medium text-sm text-gray-900 pl-6">
                      {batch.batchId}
                    </TableCell>
                    <TableCell className="text-sm text-gray-900">
                      {batch.name}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(batch.status)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 text-center">
                      {batch.images}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 text-center">
                      {batch.size}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 text-center">
                      {batch.date}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => router.push(`/admin/batches/${batch.id}`)}
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4 text-gray-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Empty State */}
          {filteredBatches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Search className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Nenhum lote encontrado
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Tente ajustar sua busca ou filtros
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}