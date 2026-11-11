// Chamadas à API: toda requisição leva o cookie da sessão, e um 401 encerra a sessão no navegador.

import type {
  AlteracaoDeMembro, Criterios, ImagemEnviada, Linha, LinhaComTotais, Lote, LoteComCapturas, Membro,
  MembroDaSessao, MetricasDoDashboard, NovoMembro, ResultadoDaAnalise, ResumoDaEquipe, StatusDoSistema,
  UsoDoArmazenamento,
} from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
// Nessas rotas o 401 é resposta esperada (senha errada), não sessão expirada.
const ROTAS_SEM_LOGOUT = ["/api/auth/login", "/api/auth/change-password"]

export class CredenciaisInvalidas extends Error {
  constructor() {
    super("Matrícula, e-mail ou senha incorretos.")
  }
}

export async function chamarApi(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  const resposta = await fetch(`${API}${caminho}`, { cache: "no-store", ...opcoes, credentials: "include" })
  if (resposta.status === 401 && !ROTAS_SEM_LOGOUT.includes(caminho)) await sair()
  return resposta
}

async function mensagemDeErro(resposta: Response, padrao: string): Promise<string> {
  const corpo = await resposta.json().catch(() => null)
  return typeof corpo?.message === "string" ? corpo.message : padrao
}

async function pedir<T>(caminho: string, erro: string, metodo = "GET", corpo?: unknown): Promise<T> {
  const resposta = await chamarApi(caminho, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, erro))
  return resposta.status === 204 ? (undefined as T) : resposta.json()
}

const filtroDeLinha = (linhaId?: string) => (linhaId ? `?unitId=${encodeURIComponent(linhaId)}` : "")

export function urlDoAvatar(usuarioGithub: string) {
  return `https://github.com/${usuarioGithub}.png`
}

export function paginaInicial(membro: MembroDaSessao) {
  if (membro.mustChangePassword) return "/trocar-senha"
  return membro.role === "ADMIN" ? "/admin" : "/inspecao"
}

// ===== Sessão =====

export async function entrar(identificador: string, senha: string): Promise<MembroDaSessao> {
  const resposta = await chamarApi("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identificador, password: senha }),
  })
  if (resposta.status === 429) throw new Error("Muitas tentativas. Aguarde um minuto e tente novamente.")
  if (resposta.status === 401) throw new CredenciaisInvalidas()
  if (!resposta.ok) throw new Error("Não foi possível entrar. Tente novamente.")
  return resposta.json()
}

export async function sair(): Promise<void> {
  await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined)
  window.location.assign("/")
}

export const minhaConta = () => pedir<MembroDaSessao>("/api/auth/me", "Não foi possível carregar sua conta.")

export const trocarSenha = (senhaAtual: string, novaSenha: string) =>
  pedir<MembroDaSessao>("/api/auth/change-password", "Não foi possível trocar a senha.", "POST", { currentPassword: senhaAtual, newPassword: novaSenha })

// ===== Inspeção =====

export async function enviarImagens(arquivos: File[]): Promise<{ batch_timestamp: string; files: ImagemEnviada[] }> {
  const formulario = new FormData()
  arquivos.forEach((arquivo) => formulario.append("files", arquivo))
  const resposta = await chamarApi("/upload-batch", { method: "POST", body: formulario })
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, "Não foi possível enviar as imagens."))
  return resposta.json()
}

export const analisarImagens = (imagens: ImagemEnviada[]) =>
  pedir<{ results: ResultadoDaAnalise[] }>("/process-images", "Não foi possível analisar as imagens.", "POST", { images: imagens })

export const registrarLote = (lote: unknown) => pedir<{ batch_id: string }>("/api/batches/create", "Não foi possível registrar o lote.", "POST", lote)

export const descartarLote = (timestamp: string) =>
  pedir<void>("/api/batches/reject", "Não foi possível reprovar o lote. Tente novamente.", "POST", { timestamp })

// ===== Lotes =====

export const listarLotes = async (linhaId?: string) =>
  (await pedir<{ batches: Lote[] }>(`/api/batches${filtroDeLinha(linhaId)}`, "Não foi possível carregar os lotes.")).batches

export const detalharLote = (id: string) => pedir<LoteComCapturas>(`/api/batches/${id}`, "Não foi possível carregar o lote.")

export const minhasColetas = async () => (await pedir<{ batches: Lote[] }>("/api/batches/mine", "Tente novamente em instantes.")).batches

export const detalharMinhaColeta = (id: string) => pedir<LoteComCapturas>(`/api/batches/mine/${id}`, "Coleta não encontrada.")

export const apagarLote = (id: string) => pedir<void>(`/api/batches/${id}`, "Não foi possível excluir o lote.", "DELETE")

export const metricasDoDashboard = (linhaId?: string) =>
  pedir<MetricasDoDashboard>(`/api/metrics/dashboard${filtroDeLinha(linhaId)}`, "Não foi possível carregar as métricas.")

// ===== Equipe =====

export const resumoDaEquipe = () => pedir<ResumoDaEquipe>("/api/team/overview", "Não foi possível carregar a equipe.")

export const listarMembros = () => pedir<Membro[]>("/api/members", "Não foi possível carregar os membros.")

export const criarMembro = (membro: NovoMembro) => pedir<Membro>("/api/members", "Não foi possível criar o membro.", "POST", membro)

export const alterarMembro = (id: string, alteracao: AlteracaoDeMembro) =>
  pedir<Membro>(`/api/members/${id}`, "Não foi possível salvar as alterações.", "PATCH", alteracao)

export const redefinirSenha = (id: string, senhaTemporaria: string) =>
  pedir<Membro>(`/api/members/${id}/reset-password`, "Não foi possível definir a senha.", "POST", { temporaryPassword: senhaTemporaria })

export const removerMembro = (id: string) => pedir<void>(`/api/members/${id}`, "Não foi possível remover o membro.", "DELETE")

export const listarLinhas = () => pedir<LinhaComTotais[]>("/api/units", "Não foi possível carregar as linhas.")

export const minhasLinhas = () => pedir<Linha[]>("/api/units/mine", "Não foi possível carregar suas linhas.")

export const criarLinha = (nome: string) => pedir<Linha>("/api/units", "Não foi possível criar a linha.", "POST", { name: nome })

export const renomearLinha = (id: string, nome: string) =>
  pedir<Linha>(`/api/units/${id}`, "Não foi possível renomear a linha.", "PATCH", { name: nome })

export const removerLinha = (id: string) => pedir<void>(`/api/units/${id}`, "Não foi possível remover a linha.", "DELETE")

// ===== Configurações =====

export const lerCriterios = () => pedir<Criterios>("/api/settings/inspection", "Não foi possível carregar os critérios de inspeção.")

export function salvarCriterios({ updatedAt: _atualizadoEm, updatedByMatricula: _por, ...criterios }: Criterios) {
  return pedir<Criterios>("/api/settings/inspection", "Não foi possível salvar os critérios.", "PUT", criterios)
}

export const usoDoArmazenamento = () => pedir<UsoDoArmazenamento>("/api/settings/storage", "Não foi possível ler o armazenamento.")

export const limparRevisoesAbandonadas = () =>
  pedir<UsoDoArmazenamento["abandoned"]>("/api/settings/storage/cleanup", "Não foi possível limpar as revisões abandonadas.", "POST")

export const statusDoSistema = () => pedir<StatusDoSistema>("/api/settings/status", "Não foi possível verificar o sistema.")
