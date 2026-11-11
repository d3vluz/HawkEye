// ===== Sessão e equipe =====

export type Perfil = "ADMIN" | "EMPLOYEE"

export interface MembroDaSessao {
  id: string
  name: string
  matricula: string | null
  email: string | null
  githubUsername: string | null
  role: Perfil
  mustChangePassword: boolean
}

export interface Linha {
  id: string
  name: string
}

export interface LinhaComTotais extends Linha {
  memberCount: number
  batchCount: number
}

export interface Membro extends Omit<MembroDaSessao, "mustChangePassword"> {
  phone: string | null
  allUnits: boolean
  lastAccessAt: string | null
  hasPassword: boolean
  units: Linha[]
}

export interface NovoMembro {
  name: string
  matricula: string
  phone?: string
  email?: string
  temporaryPassword: string
  allUnits: boolean
  unitIds: string[]
}

export type AlteracaoDeMembro = Partial<Pick<Membro, "name" | "phone" | "email" | "role">>

export interface ResumoDaEquipe {
  members: number
  activeToday: number
  units: number
}

// ===== Defeitos =====

export type Defeito = "missing" | "extra" | "wrongColor" | "damaged" | "shaft" | "structure"
export type Defeitos = Record<Defeito, boolean>

export interface Correcao {
  defect: Defeito
  detected: boolean
  corrected: boolean
}

// ===== Lote e capturas =====

export interface Lote {
  id: string
  name: string
  description: string | null
  created_at: string
  author: { matricula: string; name: string | null } | null
  unit: Linha | null
  total_captures: number
  valid_captures: number
  invalid_captures: number
  total_defects: number
  quality_score: number
}

// Captura já registrada num lote.
export interface Captura {
  id: string
  filename: string
  is_valid: boolean
  original_uri: string
  processed_uri: string | null
  processed_areas_uri: string | null
  processed_pins_uri: string | null
  processed_shaft_uri: string | null
  defects_count: number
  defects: Defeitos
  corrections: Correcao[] | null
}

export interface LoteComCapturas {
  batch: Lote
  captures: Captura[]
}

// Imagem enviada ao bucket de revisão, ainda sem análise.
export interface ImagemEnviada {
  filename: string
  storage_path: string
  sha256: string
  timestamp: string
}

// Resultado do worker para uma imagem, antes de o lote ser registrado.
export interface ResultadoDaAnalise extends Omit<ImagemEnviada, "storage_path"> {
  original_url: string
  areas_url: string
  pins_url: string
  boxes_url: string
  shafts_url: string
  areas_count: number
  grid_rows: number
  grid_cols: number
  missing_dividers: Array<{ orientation: "vertical" | "horizontal" }>
  pins_count: number
  boxes_info: { empty_boxes: number; multiple_pins_boxes: number }
  pin_classification: {
    details: { pins_ok: number; pins_wrong_color: number; pins_damaged_yellow: number; pins_double_defect: number }
  }
  shaft_classification: { rejected_shafts: number }
}

export type Camada = "original" | "areas" | "pins" | "boxes" | "shafts"

// Como uma captura aparece na tela, venha da revisão (worker) ou de um lote registrado (banco).
export interface ItemDeCaptura {
  chave: string
  nome: string
  imagens: Record<Camada, string>
  reprovacoes: string[]
  corrigida: boolean
}

// ===== Configurações =====

export interface Criterios {
  expectedRows: number | null
  expectedCols: number | null
  minQualityScore: number
  rejectMissingPins: boolean
  rejectExtraPins: boolean
  rejectDamagedPins: boolean
  rejectWrongColorPins: boolean
  rejectStructureDamage: boolean
  rejectShaftDefects: boolean
  updatedAt?: string
  updatedByMatricula?: string | null
}

export interface UsoDoArmazenamento {
  review: { objects: number; bytes: number }
  permanent: { objects: number; bytes: number }
  abandoned: { sessions: number; objects: number; bytes: number }
  abandonedAfterHours: number
}

export interface VerificacaoDeServico {
  status: "online" | "offline"
  latencyMs: number
  error?: string
}

export interface StatusDoSistema {
  checkedAt: string
  api: { status: "online"; uptimeSeconds: number }
  database: VerificacaoDeServico
  storage: VerificacaoDeServico
  worker: VerificacaoDeServico
}

// ===== Dashboard =====

export interface ResumoDoPeriodo {
  batches: number
  captures: number
  approvalRate: number | null
  defectsPerCapture: number | null
  belowTarget: number
}

export interface MetricasDoDashboard {
  periodDays: number
  qualityTarget: number
  totals: { batches: number; captures: number; approvalRate: number | null }
  current: ResumoDoPeriodo
  previous: ResumoDoPeriodo
  series: Array<{ date: string; captures: number; approvalRate: number | null; defectsPerCapture: number | null }>
  defectsByType: Array<{ key: string; label: string; captures: number; share: number | null; previousShare: number | null }>
  units: Array<{ id: string | null; name: string } & ResumoDoPeriodo>
  operators: Array<{ matricula: string; name: string | null } & ResumoDoPeriodo>
  recentBatches: Lote[]
}
