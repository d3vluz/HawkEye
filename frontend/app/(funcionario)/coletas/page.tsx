"use client"

// Lotes que o próprio funcionário registrou.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus } from "lucide-react"
import { Cabecalho } from "@/components/cabecalho"
import { TabelaDeLotes } from "@/components/tabela-de-lotes"
import { Button } from "@/components/ui/button"
import { minhasColetas } from "@/lib/api"
import type { Lote } from "@/types"

export default function PaginaDeColetas() {
  const [coletas, setColetas] = useState<Lote[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    minhasColetas().then(setColetas).catch((e: Error) => { setErro(e.message); setColetas([]) })
  }, [])

  if (!coletas) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-12 animate-spin text-signal" aria-label="Carregando coletas" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <Cabecalho
        trilha={[{ rotulo: "Inspeção", href: "/inspecao" }, { rotulo: "Minhas coletas" }]}
        titulo="Minhas coletas"
        descricao="Consulte os lotes que você registrou e a análise de cada imagem."
      />

      {erro && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger-emphasis">
          <p className="font-medium">Não foi possível carregar suas coletas</p>
          <p className="text-sm">{erro}</p>
        </div>
      )}

      <TabelaDeLotes
        titulo="Coletas"
        lotes={coletas}
        endereco={(lote) => `/coletas/${lote.id}`}
        vazio={{
          titulo: "Você ainda não tem coletas",
          texto: (
            <>
              <p className="mb-4">Os lotes registrados por você aparecem aqui.</p>
              <Button asChild>
                <Link href="/inspecao"><Plus className="size-4" /> Nova inspeção</Link>
              </Button>
            </>
          ),
        }}
      />
    </div>
  )
}
