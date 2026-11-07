"use client"

// Detalhe de um lote registrado pelo próprio funcionário.

import { use } from "react"
import { DetalheDoLote } from "@/components/detalhe-do-lote"
import { detalharMinhaColeta } from "@/lib/api"

export default function PaginaDaColeta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DetalheDoLote id={id} carregar={detalharMinhaColeta} trilha={[{ rotulo: "Inspeção", href: "/inspecao" }, { rotulo: "Minhas coletas", href: "/coletas" }]} />
}
