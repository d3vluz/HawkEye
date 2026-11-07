"use client"

// Estrutura das telas de login e troca de senha: formulário à esquerda e ilustração à direita.

import { useEffect, useState, type ReactNode } from "react"
import { Github, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Ilustracao } from "@/components/acesso/ilustracao"
import { Button } from "@/components/ui/button"

const REPOSITORIO = "https://github.com/d3vluz/HawkEye"
// Máscara em vez de <Image>: a mesma arte assume a cor do texto nos dois temas.
const MASCARA_DO_LOGO = "url(/logo.png) center / contain no-repeat"

function BotaoDeTema() {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  if (!montado) return <div className="size-9" />
  const escuro = resolvedTheme === "dark"
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground"
    >
      {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

export function LayoutDeAcesso({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(460px,5fr)_minmax(0,7fr)]">
      <main className="relative isolate flex min-w-0 flex-col overflow-hidden bg-card px-6 py-6 sm:px-10 lg:border-r lg:border-border xl:px-14">
        <div aria-hidden className="auth-backdrop pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" />

        <header className="flex justify-end">
          <BotaoDeTema />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="auth-enter w-full max-w-[400px]">
            <div className="mb-10 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-background">
                <span aria-hidden className="block size-8 bg-foreground" style={{ mask: MASCARA_DO_LOGO, WebkitMask: MASCARA_DO_LOGO }} />
              </span>
              <span className="text-xl font-semibold tracking-tight text-foreground">HawkEye</span>
            </div>
            <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.02em] text-balance text-foreground">{titulo}</h1>
            <p className="mt-2 mb-8 text-[15px] leading-relaxed text-pretty text-muted-foreground">{descricao}</p>
            {children}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} HawkEye</span>
          <a
            href={REPOSITORIO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Github className="size-4" aria-hidden />
            Código no GitHub
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        </footer>
      </main>
      <Ilustracao />
    </div>
  )
}
