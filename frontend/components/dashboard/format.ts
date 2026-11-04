export const number = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const percent = (value: number | null, digits = 1) => (value === null ? "—" : `${number(value, digits)}%`)

export const shortDate = (iso: string) => {
  const [, month, day] = iso.split("-")
  return `${day}/${month}`
}

export const plural = (count: number, one: string, many: string) => `${number(count)} ${count === 1 ? one : many}`
