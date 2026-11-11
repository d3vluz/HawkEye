"use client"

// Atalho de teclado: ← e → trocam de captura, exceto enquanto a pessoa digita num campo ou com um diálogo aberto.

import { useEffect } from "react"

export function useSetas(ativo: boolean, indice: number, irPara: (indice: number) => void) {
  useEffect(() => {
    if (!ativo) return
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement
      if (alvo.closest("input, textarea, select, [role=listbox], [role=dialog], [role=alertdialog], [contenteditable]")) return
      if (evento.key === "ArrowRight") irPara(indice + 1)
      if (evento.key === "ArrowLeft") irPara(indice - 1)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [ativo, indice, irPara])
}
