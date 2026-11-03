"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Eye, Loader2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getMyCollections, type Batch } from "@/lib/api-client"

function qualityClass(score: number) {
  if (score >= 80) return "text-success-emphasis"
  return score >= 60 ? "text-warning-emphasis" : "text-danger-emphasis"
}

export default function MyCollectionsPage() {
  const router = useRouter()
  const [collections, setCollections] = useState<Batch[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyCollections()
      .then(setCollections)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return collections
    return collections.filter((c) => c.name.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query))
  }, [collections, search])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-signal mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Carregando coletas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 tracking-wider">
          <span>INSPEÇÃO</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">MINHAS COLETAS</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Minhas coletas</h1>
        <p className="text-muted-foreground text-sm">Consulte os lotes que você aprovou e as análises de cada imagem.</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg text-danger-emphasis">
          <p className="font-medium">Não foi possível carregar suas coletas</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              Coletas
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">({filtered.length})</span>
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar coletas"
                placeholder="Buscar coletas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 text-xs font-semibold text-foreground">Código</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">Descrição</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">Linha</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-foreground">Imagens</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-foreground">Defeitos</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-foreground">Qualidade</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-foreground">Data</TableHead>
                  <TableHead className="pr-6"><span className="sr-only">Ver detalhes</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell className="pl-6 text-sm font-medium text-foreground">{collection.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{collection.description || "-"}</TableCell>
                    <TableCell className="text-sm text-foreground">{collection.unit?.name ?? "-"}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{collection.total_captures}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{collection.total_defects}</TableCell>
                    <TableCell className={`text-center text-sm font-semibold tabular-nums ${qualityClass(collection.quality_score)}`}>
                      {collection.quality_score.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {new Date(collection.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Ver detalhes de ${collection.name}`}
                        onClick={() => router.push(`/coletas/${collection.id}`)}
                      >
                        <Eye className="h-4 w-4 text-signal" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <h3 className="text-base font-semibold text-foreground mb-2">
                {search ? "Nenhuma coleta encontrada" : "Você ainda não tem coletas"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "Tente ajustar sua busca." : "Os lotes aprovados por você aparecem aqui."}
              </p>
              {!search && (
                <Button asChild>
                  <Link href="/inspecao"><Plus className="h-4 w-4" /> Nova inspeção</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
