export const PHONE_MAX_DIGITS = 11

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS)
}

// Formata conforme o número cresce, para servir de máscara no campo e na exibição.
export function formatPhone(value: string | null | undefined): string {
  const digits = phoneDigits(value ?? "")
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const split = rest.length === 9 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

export function isCompletePhone(value: string): boolean {
  const length = phoneDigits(value).length
  return length === 10 || length === 11
}
