"use client"

// Troca obrigatória da senha temporária no primeiro acesso ou após o admin redefini-la.

import { useState, type FormEvent } from "react"
import { Loader2, LockKeyhole } from "lucide-react"
import { CampoDeSenha, ErroDoFormulario } from "@/components/acesso/campos"
import { LayoutDeAcesso } from "@/components/acesso/layout-de-acesso"
import { Button } from "@/components/ui/button"
import { paginaInicial, sair, trocarSenha } from "@/lib/api"

const TAMANHO_MINIMO = 8

type Campo = "atual" | "nova" | "confirmacao"

export default function PaginaDeTrocaDeSenha() {
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [campoInvalido, setCampoInvalido] = useState<Campo | null>(null)
  const [enviando, setEnviando] = useState(false)

  const falhar = (mensagem: string | null, campo: Campo | null) => {
    setErro(mensagem)
    setCampoInvalido(campo)
  }

  const aoEnviar = async (evento: FormEvent) => {
    evento.preventDefault()
    falhar(null, null)
    if (novaSenha.length < TAMANHO_MINIMO) return falhar(`A nova senha precisa ter ao menos ${TAMANHO_MINIMO} caracteres.`, "nova")
    if (novaSenha !== confirmacao) return falhar("A confirmação não é igual à nova senha.", "confirmacao")

    setEnviando(true)
    try {
      const membro = await trocarSenha(senhaAtual, novaSenha)
      window.location.assign(paginaInicial(membro))
    } catch (e) {
      const mensagem = (e as Error).message
      if (e instanceof TypeError) falhar("Não foi possível conectar ao servidor. Tente novamente.", null)
      else falhar(mensagem, mensagem === "Senha atual incorreta" ? "atual" : "nova")
      setEnviando(false)
    }
  }

  return (
    <LayoutDeAcesso titulo="Crie sua senha" descricao="Sua senha temporária precisa ser trocada antes de continuar.">
      <form onSubmit={aoEnviar} className="space-y-5">
        <CampoDeSenha
          id="senha-atual"
          rotulo="Senha temporária"
          icone={LockKeyhole}
          invalido={campoInvalido === "atual"}
          autoComplete="current-password"
          required
          value={senhaAtual}
          onChange={(evento) => setSenhaAtual(evento.target.value)}
        />
        <CampoDeSenha
          id="nova-senha"
          rotulo="Nova senha"
          icone={LockKeyhole}
          invalido={campoInvalido === "nova"}
          dica={`Use ao menos ${TAMANHO_MINIMO} caracteres.`}
          autoComplete="new-password"
          required
          value={novaSenha}
          onChange={(evento) => setNovaSenha(evento.target.value)}
        />
        <CampoDeSenha
          id="confirmacao"
          rotulo="Confirmar nova senha"
          icone={LockKeyhole}
          invalido={campoInvalido === "confirmacao"}
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
        />
        <ErroDoFormulario mensagem={erro} />
        <Button type="submit" disabled={enviando} className="h-11 w-full text-[15px] font-semibold">
          {enviando && <Loader2 className="size-4 animate-spin" />}
          {enviando ? "Salvando…" : "Salvar e continuar"}
        </Button>
      </form>
      <Button type="button" variant="ghost" onClick={sair} className="mt-3 h-11 w-full text-muted-foreground">
        Sair
      </Button>
    </LayoutDeAcesso>
  )
}
