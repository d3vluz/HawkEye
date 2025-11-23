"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Search, Eye, ChevronRight, Loader2, Trash2 } from "lucide-react"
import { getBatches, deleteBatch } from "@/lib/supabase/dashboard-service"
import type { Batch } from "@/lib/supabase/supabase"

export default function LotesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadBatches()
  }, [])

  const loadBatches = async () => {
    try {
      setLoading(true)
      const { batches: data } = await getBatches(1, 100) // Carregar primeiros 100
      setBatches(data)
      setError(null)
    } catch (err) {
      console.error('Erro ao carregar lotes:', err)
      setError(err instanceof Error ? err.message : "Erro ao carregar lotes")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (batchId: string, batchName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o lote "${batchName}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    try {
      setDeleting(batchId)
      await deleteBatch(batchId)
      // Atualizar lista removendo o batch deletado
      setBatches(batches.filter(b => b.id !== batchId))
    } catch (err) {
      console.error('Erro ao deletar lote:', err)
      alert('Erro ao deletar lote. Tente novamente.')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatQualityScore = (score: number | null) => {
    if (score === null) return '-'
    return `${score.toFixed(1)}%`
  }

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando lotes...</p>
        </div>
      </div>
    )
  }

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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Table Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {/* Table Header com Search */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                Todos os Lotes
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredBatches.length})
                </span>
              </h2>
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
            </div>
          </div>

          {/* Table Wrapper com Scroll Horizontal */}
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-700 text-xs w-[200px] pl-6">Código</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[280px]">Descrição</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[100px] text-center">Imagens</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[100px] text-center">Defeitos</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[110px] text-center">Qualidade</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[120px] text-center">Data</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs w-[120px] text-center pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow 
                    key={batch.id} 
                    className="hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <TableCell className="font-medium text-sm text-gray-900 pl-6">
                      {batch.name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {batch.description || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{batch.total_captures}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{batch.total_defects}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-semibold ${
                          (batch.quality_score || 0) >= 80 ? 'text-green-700' :
                          (batch.quality_score || 0) >= 60 ? 'text-yellow-600' :
                          'text-red-700'
                        }`}>
                          {formatQualityScore(batch.quality_score)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 text-center">
                      {formatDate(batch.created_at)}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-blue-50"
                          onClick={() => router.push(`/admin/batches/${batch.id}`)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4 text-blue-700" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-red-50"
                          onClick={() => handleDelete(batch.id, batch.name)}
                          disabled={deleting === batch.id}
                          title="Deletar lote"
                        >
                          {deleting === batch.id ? (
                            <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-700" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Empty State */}
          {filteredBatches.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Search className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Nenhum lote encontrado
              </h3>
              <p className="text-sm text-gray-600 text-center">
                {searchTerm ? 'Tente ajustar sua busca' : 'Processe alguns lotes para começar'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}