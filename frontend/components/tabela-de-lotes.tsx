"use client"

// Tabela de lotes com busca, usada na lista do admin e nas coletas do funcionário.

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Eye, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { data, percentual } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { Lote } from "@/types"

const CABECALHO = "text-xs font-semibold text-foreground"

// Sem meta configurada, a cor segue faixas fixas.
function corDaQualidade(qualidade: number, meta: number | null) {
  if (meta !== null) return qualidade >= meta ? "text-success-emphasis" : "text-danger-emphasis"
  if (qualidade >= 80) return "text-success-emphasis"
  return qualidade >= 60 ? "text-warning-emphasis" : "text-danger-emphasis"
}

export function TabelaDeLotes({ titulo, lotes, endereco, meta = null, mostrarAutor = false, filtros, vazio, aoExcluir }: {
  titulo: string
  lotes: Lote[]
  endereco: (lote: Lote) => string
  meta?: number | null
  mostrarAutor?: boolean
  filtros?: ReactNode
  vazio: { titulo: string; texto: ReactNode }
  aoExcluir?: (lote: Lote) => void
}) {
  const [busca, setBusca] = useState("")

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lotes
    return lotes.filter((l) =>
      [l.name, l.description, l.author?.name, l.author?.matricula].some((campo) => campo?.toLowerCase().includes(termo))
    )
  }, [lotes, busca])

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {titulo}
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">({visiveis.length})</span>
          </h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {filtros}
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar lotes" placeholder="Buscar lotes..." value={busca} onChange={(e) => setBusca(e.target.value)} className="h-9 pl-10" />
            </div>
          </div>
        </div>

        {visiveis.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className={mostrarAutor ? "min-w-[1100px]" : "min-w-[900px]"}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(CABECALHO, "pl-6")}>Código</TableHead>
                  <TableHead className={CABECALHO}>Descrição</TableHead>
                  {mostrarAutor && <TableHead className={CABECALHO}>Coletado por</TableHead>}
                  <TableHead className={CABECALHO}>Linha</TableHead>
                  <TableHead className={cn(CABECALHO, "text-center")}>Imagens</TableHead>
                  <TableHead className={cn(CABECALHO, "text-center")}>Defeitos</TableHead>
                  <TableHead className={cn(CABECALHO, "text-center")}>Qualidade</TableHead>
                  <TableHead className={cn(CABECALHO, "text-center")}>Data</TableHead>
                  <TableHead className="pr-6"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell className="pl-6 text-sm font-medium text-foreground">{lote.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lote.description || "—"}</TableCell>
                    {mostrarAutor && (
                      <TableCell className="text-sm">
                        {lote.author ? (
                          <>
                            <p className="font-medium text-foreground">{lote.author.name ?? "Membro removido"}</p>
                            <p className="text-xs text-muted-foreground">Matrícula {lote.author.matricula}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-foreground">{lote.unit?.name ?? <span className="text-muted-foreground">Sem linha</span>}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{lote.total_captures}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{lote.total_defects}</TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={cn("font-semibold tabular-nums", corDaQualidade(lote.quality_score, meta))}>{percentual(lote.quality_score)}</span>
                      {meta !== null && lote.quality_score < meta && <span className="block text-[11px] text-muted-foreground">abaixo da meta</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{data(lote.created_at)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={endereco(lote)} aria-label={`Ver detalhes de ${lote.name}`}>
                            <Eye className="size-4 text-signal" /> Ver
                          </Link>
                        </Button>
                        {aoExcluir && (
                          <Button variant="ghost" size="icon" className="size-8 hover:bg-danger/10" aria-label={`Excluir ${lote.name}`} onClick={() => aoExcluir(lote)}>
                            <Trash2 className="size-4 text-danger-emphasis" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <h3 className="mb-2 text-base font-semibold text-foreground">{busca ? "Nenhum lote encontrado" : vazio.titulo}</h3>
            <div className="text-sm text-muted-foreground">{busca ? "Tente ajustar a busca." : vazio.texto}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
