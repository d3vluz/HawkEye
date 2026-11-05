"use client"

import { useState, type FormEvent } from "react"
import { Loader2, LockKeyhole } from "lucide-react"
import { AuthShell, FormError, PasswordField } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { changePassword, homeFor, logout } from "@/lib/api-client"

const MIN_PASSWORD_LENGTH = 8

type Field = "current" | "new" | "confirmation"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [invalidField, setInvalidField] = useState<Field | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fail = (message: string, field: Field | null) => {
    setError(message)
    setInvalidField(field)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    fail("", null)
    if (newPassword.length < MIN_PASSWORD_LENGTH) return fail(`A nova senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`, "new")
    if (newPassword !== confirmation) return fail("A confirmação não é igual à nova senha.", "confirmation")

    setSubmitting(true)
    try {
      const member = await changePassword(currentPassword, newPassword)
      window.location.assign(homeFor(member))
    } catch (err) {
      if (err instanceof TypeError) fail("Não foi possível conectar ao servidor. Tente novamente.", null)
      else fail((err as Error).message, (err as Error).message === "Senha atual incorreta" ? "current" : "new")
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Crie sua senha" description="Sua senha temporária precisa ser trocada antes de continuar.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <PasswordField
          id="current-password"
          label="Senha temporária"
          icon={LockKeyhole}
          invalid={invalidField === "current"}
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <PasswordField
          id="new-password"
          label="Nova senha"
          icon={LockKeyhole}
          invalid={invalidField === "new"}
          hint={`Use ao menos ${MIN_PASSWORD_LENGTH} caracteres.`}
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordField
          id="confirm-password"
          label="Confirmar nova senha"
          icon={LockKeyhole}
          invalid={invalidField === "confirmation"}
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" disabled={submitting} className="h-11 w-full text-[15px] font-semibold">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Salvando…" : "Salvar e continuar"}
        </Button>
      </form>
      <Button type="button" variant="ghost" onClick={logout} className="mt-3 h-11 w-full text-muted-foreground">
        Sair
      </Button>
    </AuthShell>
  )
}
