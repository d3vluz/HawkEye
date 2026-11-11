"use client"

// Diálogo para confirmar ações destrutivas (excluir, reprovar), com estado de envio e erro.

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"

export function DialogoDeConfirmacao({ aberto, titulo, descricao, confirmar, confirmando, enviando, erro, aoConfirmar, aoCancelar }: {
  aberto: boolean
  titulo: string
  descricao: string
  confirmar: string
  confirmando: string
  enviando?: boolean
  erro?: string | null
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(abrir) => { if (!abrir && !enviando) aoCancelar() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{titulo}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</DialogPrimitive.Description>
          {erro && <p role="alert" className="mt-3 text-sm text-danger-emphasis">{erro}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={aoCancelar} disabled={enviando}>Cancelar</Button>
            <Button variant="destructive" onClick={aoConfirmar} disabled={enviando}>{enviando ? confirmando : confirmar}</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
