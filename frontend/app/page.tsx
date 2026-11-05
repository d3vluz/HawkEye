"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Info, Loader2, LockKeyhole, UserRound } from "lucide-react"
import { AuthShell, FormError, PasswordField, TextField } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { homeFor, InvalidCredentialsError, login } from "@/lib/api-client"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setInvalid(false)
    setSubmitting(true)
    try {
      const member = await login(identifier.trim(), password)
      window.location.assign(homeFor(member))
    } catch (err) {
      const isNetworkFailure = err instanceof TypeError
      setInvalid(err instanceof InvalidCredentialsError)
      setError(isNetworkFailure ? "Não foi possível conectar ao servidor. Tente novamente." : (err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Bem-vindo de volta" description="Entre para acessar o painel de inspeção.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          id="identifier"
          label="Matrícula ou e-mail"
          icon={UserRound}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          invalid={invalid}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <div className="space-y-2.5">
          <PasswordField
            id="password"
            label="Senha"
            icon={LockKeyhole}
            autoComplete="current-password"
            required
            invalid={invalid}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              aria-expanded={showRecovery}
              aria-controls="recovery-note"
              onClick={() => setShowRecovery((value) => !value)}
              className="rounded-sm text-sm font-medium text-primary-emphasis underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Esqueceu a senha?
            </button>
          </div>
          {showRecovery && (
            <div id="recovery-note" className="flex gap-2.5 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary-emphasis" aria-hidden />
              <p className="text-pretty">
                Peça ao administrador uma senha temporária. Ela também vale para o primeiro acesso: ao entrar, você cria a sua.
              </p>
            </div>
          )}
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={submitting} className="group h-11 w-full text-[15px] font-semibold">
          {submitting ? (
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
    </AuthShell>
  )
}
