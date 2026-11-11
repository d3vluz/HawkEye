"use client"

// Detalhe de qualquer lote, visto pelo admin.

import { use } from "react"
import { DetalheDoLote } from "@/components/detalhe-do-lote"
import { detalharLote } from "@/lib/api"

export default function PaginaDoLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DetalheDoLote id={id} carregar={detalharLote} trilha={[{ rotulo: "Admin", href: "/admin" }, { rotulo: "Lotes", href: "/admin/batches" }]} />
}
