"use client"

// Tela de login: entra com matrícula ou e-mail e leva cada perfil para a sua área.

import { useState, type FormEvent } from "react"
import { ArrowRight, Info, Loader2, LockKeyhole, UserRound } from "lucide-react"
import { CampoDeSenha, CampoDeTexto, ErroDoFormulario } from "@/components/acesso/campos"
import { LayoutDeAcesso } from "@/components/acesso/layout-de-acesso"
import { Button } from "@/components/ui/button"
import { CredenciaisInvalidas, entrar, paginaInicial } from "@/lib/api"

export default function PaginaDeLogin() {
  const [identificador, setIdentificador] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [invalido, setInvalido] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false)

  const aoEnviar = async (evento: FormEvent) => {
    evento.preventDefault()
    setErro(null)
    setInvalido(false)
    setEnviando(true)
    try {
      const membro = await entrar(identificador.trim(), senha)
      window.location.assign(paginaInicial(membro))
    } catch (e) {
      setInvalido(e instanceof CredenciaisInvalidas)
      setErro(e instanceof TypeError ? "Não foi possível conectar ao servidor. Tente novamente." : (e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <LayoutDeAcesso titulo="Bem-vindo de volta" descricao="Entre para acessar o painel de inspeção.">
      <form onSubmit={aoEnviar} className="space-y-5">
        <CampoDeTexto
          id="identificador"
          rotulo="Matrícula ou e-mail"
          icone={UserRound}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          invalido={invalido}
          value={identificador}
          onChange={(evento) => setIdentificador(evento.target.value)}
        />
        <div className="space-y-2.5">
          <CampoDeSenha
            id="senha"
            rotulo="Senha"
            icone={LockKeyhole}
            autoComplete="current-password"
            required
            invalido={invalido}
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              aria-expanded={mostrarRecuperacao}
              aria-controls="aviso-de-recuperacao"
              onClick={() => setMostrarRecuperacao((v) => !v)}
              className="rounded-sm text-sm font-medium text-primary-emphasis underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Esqueceu a senha?
            </button>
          </div>
          {mostrarRecuperacao && (
            <div id="aviso-de-recuperacao" className="flex gap-2.5 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary-emphasis" aria-hidden />
              <p className="text-pretty">
                Peça ao administrador uma senha temporária. Ela também vale para o primeiro acesso: ao entrar, você cria a sua.
              </p>
            </div>
          )}
        </div>
        <ErroDoFormulario mensagem={erro} />
        <Button type="submit" disabled={enviando} className="group h-11 w-full text-[15px] font-semibold">
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Entrando…
            </>
          ) : (
            <>
              Entrar
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </>
          )}
        </Button>
      </form>
    </LayoutDeAcesso>
  )
}
