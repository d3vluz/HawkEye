// Formatação para exibição: números, percentuais, datas, último acesso e máscara de telefone.

export const numero = (valor: number, casas = 0) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const percentual = (valor: number | null, casas = 1) => (valor === null ? "—" : `${numero(valor, casas)}%`)

export const plural = (quantidade: number, um: string, varios: string) => `${numero(quantidade)} ${quantidade === 1 ? um : varios}`

// Recebe "AAAA-MM-DD", como vem na série do dashboard.
export const diaEMes = (data: string) => {
  const [, mes, dia] = data.split("-")
  return `${dia}/${mes}`
}

export const dataEHora = (data: string) =>
  new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR")

export function bytes(valor: number) {
  if (valor < 1024) return `${valor} B`
  const unidades = ["KB", "MB", "GB", "TB"]
  let tamanho = valor / 1024
  let i = 0
  while (tamanho >= 1024 && i < unidades.length - 1) {
    tamanho /= 1024
    i++
  }
  return `${tamanho.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unidades[i]}`
}

function diasAtras(data: string) {
  const d = new Date(data)
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  return Math.round((hoje - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
}

export const iniciais = (nome: string) => nome.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()

export const acessouHoje = (data: string | null | undefined) => Boolean(data) && diasAtras(data!) <= 0

export function ultimoAcesso(data: string | null | undefined) {
  if (!data) return "Nunca"
  const dias = diasAtras(data)
  if (dias <= 0) return "Hoje"
  if (dias === 1) return "Ontem"
  return `Há ${dias} dias`
}

// ===== Telefone: guardado só com dígitos, exibido com máscara =====

export const DIGITOS_DO_TELEFONE = 11

export const digitosDoTelefone = (valor: string) => valor.replace(/\D/g, "").slice(0, DIGITOS_DO_TELEFONE)

// Formata conforme o número cresce, para servir de máscara no campo e na exibição.
export function telefone(valor: string | null | undefined) {
  const digitos = digitosDoTelefone(valor ?? "")
  if (!digitos) return ""
  if (digitos.length <= 2) return `(${digitos}`
  const ddd = digitos.slice(0, 2)
  const resto = digitos.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const corte = resto.length === 9 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

export const telefoneCompleto = (valor: string) => [10, 11].includes(digitosDoTelefone(valor).length)
