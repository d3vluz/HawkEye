"use client"

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { AuthShell, FormError, PasswordField, TextField } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { homeFor, InvalidCredentialsError, login } from "@/lib/api-client"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
    <AuthShell title="Entrar no HawkEye" description="Use seu e-mail ou credencial e sua senha para acessar sua área.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          id="identifier"
          label="E-mail ou credencial"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          invalid={invalid}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="current-password"
          required
          invalid={invalid}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" disabled={submitting} className="h-10 w-full font-semibold">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-pretty text-muted-foreground">Sem acesso ou esqueceu a senha? Fale com o administrador.</p>
    </AuthShell>
  )
}
