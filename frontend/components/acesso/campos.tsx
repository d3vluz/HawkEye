"use client"

// Campos dos formulários de login e troca de senha: texto, senha (mostrar/ocultar e aviso de Caps Lock) e erro.

import { useState, type ComponentProps, type KeyboardEvent } from "react"
import { Eye, EyeOff, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const ESTILO_DO_CAMPO = "h-11 border-[var(--graphite-600)]/40 bg-card shadow-none dark:border-[var(--graphite-600)]/60 transition-[border-color,box-shadow] hover:border-[var(--graphite-600)]"
const ID_DO_ERRO = "erro-do-formulario"

type PropsDoCampo = ComponentProps<typeof Input> & { id: string; rotulo: string; invalido?: boolean; icone?: LucideIcon }

export function ErroDoFormulario({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null
  return (
    <p id={ID_DO_ERRO} role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger-emphasis">
      {mensagem}
    </p>
  )
}

function IconeDoCampo({ icone: Icone }: { icone?: LucideIcon }) {
  if (!Icone) return null
  return (
    <Icone
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary-emphasis"
    />
  )
}

export function CampoDeTexto({ id, rotulo, invalido, icone, className, ...props }: PropsDoCampo) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground">{rotulo}</Label>
      <div className="group relative">
        <IconeDoCampo icone={icone} />
        <Input
          id={id}
          className={cn(ESTILO_DO_CAMPO, icone && "pl-10", className)}
          aria-invalid={invalido || undefined}
          aria-describedby={invalido ? ID_DO_ERRO : undefined}
          {...props}
        />
      </div>
    </div>
  )
}

export function CampoDeSenha({ id, rotulo, dica, invalido, icone, onKeyUp, onKeyDown, ...props }: PropsDoCampo & { dica?: string }) {
  const [visivel, setVisivel] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const descritores = [dica && `${id}-dica`, capsLock && `${id}-caps`, invalido && ID_DO_ERRO].filter(Boolean).join(" ")
  const verificarCapsLock = (evento: KeyboardEvent<HTMLInputElement>) => setCapsLock(evento.getModifierState("CapsLock"))

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground">{rotulo}</Label>
      <div className="group relative">
        <IconeDoCampo icone={icone} />
        <Input
          id={id}
          type={visivel ? "text" : "password"}
          className={cn(ESTILO_DO_CAMPO, "pr-11", icone && "pl-10")}
          aria-invalid={invalido || undefined}
          aria-describedby={descritores || undefined}
          onKeyDown={(evento) => { verificarCapsLock(evento); onKeyDown?.(evento) }}
          onKeyUp={(evento) => { verificarCapsLock(evento); onKeyUp?.(evento) }}
          onBlur={() => setCapsLock(false)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
          className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {capsLock && <p id={`${id}-caps`} className="text-xs text-warning-emphasis">Caps Lock está ativado.</p>}
      {dica && <p id={`${id}-dica`} className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}
