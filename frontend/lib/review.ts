import type { InspectionSettings } from "@/lib/api-client"
import { detectedDefects, evaluateCapture } from "@/lib/inspection"

export interface ProcessedImage {
  filename: string
  sha256: string
  timestamp: string
  original_url: string
  areas_url: string
  pins_url: string
  boxes_url: string
  shafts_url: string
  areas_count: number
  grid_rows?: number
  grid_cols?: number
  missing_dividers?: Array<{ orientation: "vertical" | "horizontal" }>
  pins_count: number
  boxes_info: {
    total_boxes: number
    empty_boxes: number
    single_pin_boxes: number
    multiple_pins_boxes: number
    boxes: Array<{ x: number; y: number; width: number; height: number; pins_count: number; status: "empty" | "single" | "multiple" }>
  }
  pin_classification: {
    total_pins: number
    details: { pins_ok: number; pins_wrong_color: number; pins_damaged_yellow: number; pins_double_defect: number }
  }
  shaft_classification: { total_shafts: number; rejected_shafts: number }
}

export type DefectKey = "missing" | "extra" | "wrongColor" | "damaged" | "shaft" | "structure"
export type Flags = Record<DefectKey, boolean>
export type Overrides = Partial<Flags>
export type ViewKey = "original" | "areas" | "pins" | "boxes" | "shafts"

export const VIEWS: Array<{ key: ViewKey; label: string; legend: Array<{ color: string; text: string }> }> = [
  { key: "original", label: "Original", legend: [] },
  {
    key: "areas", label: "Grade", legend: [
      { color: "#d946ef", text: "Divisória vertical" },
      { color: "#22c55e", text: "Divisória horizontal" },
      { color: "#ef4444", text: "Divisória ausente" },
    ],
  },
  {
    key: "pins", label: "Pinos", legend: [
      { color: "#22c55e", text: "Pino conforme" },
      { color: "#f59e0b", text: "Cor errada ou deformado" },
      { color: "#ef4444", text: "Cor errada e deformado" },
    ],
  },
  {
    key: "boxes", label: "Compartimentos", legend: [
      { color: "#22c55e", text: "Com o pino esperado" },
      { color: "#ef4444", text: "Vazio" },
      { color: "#f59e0b", text: "Pino a mais" },
    ],
  },
  {
    key: "shafts", label: "Hastes", legend: [
      { color: "#22c55e", text: "Haste íntegra" },
      { color: "#ef4444", text: "Quebrada, curta ou torta (círculo no pino)" },
    ],
  },
]

const REJECT_SETTING: Record<DefectKey, keyof InspectionSettings> = {
  missing: "rejectMissingPins",
  extra: "rejectExtraPins",
  wrongColor: "rejectWrongColorPins",
  damaged: "rejectDamagedPins",
  shaft: "rejectShaftDefects",
  structure: "rejectStructureDamage",
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export interface Check {
  key: DefectKey
  label: string
  view: ViewKey
  found: (img: ProcessedImage, settings: InspectionSettings | null) => string
  clear: string
}

export const CHECKS: Check[] = [
  {
    key: "missing", label: "Pino faltando", view: "boxes",
    found: (img) => plural(img.boxes_info?.empty_boxes ?? 0, "compartimento vazio", "compartimentos vazios"),
    clear: "Todos os compartimentos têm pino",
  },
  {
    key: "extra", label: "Pino a mais", view: "boxes",
    found: (img) => plural(img.boxes_info?.multiple_pins_boxes ?? 0, "compartimento com pino sobrando", "compartimentos com pino sobrando"),
    clear: "Nenhum compartimento com pino sobrando",
  },
  {
    key: "wrongColor", label: "Cor do pino", view: "pins",
    found: (img) => {
      const d = img.pin_classification?.details
      return plural((d?.pins_wrong_color ?? 0) + (d?.pins_double_defect ?? 0), "pino fora da cor padrão", "pinos fora da cor padrão")
    },
    clear: "Todos na cor padrão",
  },
  {
    key: "damaged", label: "Corpo do pino", view: "pins",
    found: (img) => {
      const d = img.pin_classification?.details
      return plural((d?.pins_damaged_yellow ?? 0) + (d?.pins_double_defect ?? 0), "pino deformado ou lascado", "pinos deformados ou lascados")
    },
    clear: "Nenhum pino deformado",
  },
  {
    key: "shaft", label: "Haste (agulha)", view: "shafts",
    found: (img) => plural(img.shaft_classification?.rejected_shafts ?? 0, "haste quebrada, curta ou torta", "hastes quebradas, curtas ou tortas"),
    clear: "Todas as hastes íntegras",
  },
  {
    key: "structure", label: "Estrutura da caixa", view: "areas",
    found: (img, settings) => {
      const missing = img.missing_dividers?.length ?? 0
      if (missing > 0) return plural(missing, "divisória ausente", "divisórias ausentes")
      if (settings?.expectedRows && settings.expectedCols) {
        return `Grade ${img.grid_rows ?? "?"}×${img.grid_cols ?? "?"}, esperado ${settings.expectedRows}×${settings.expectedCols}`
      }
      return "Grade fora do padrão"
    },
    clear: "Divisórias e grade conferem",
  },
]

export function autoFlags(img: ProcessedImage, settings: InspectionSettings | null): Flags {
  const d = detectedDefects(img)
  const fallback = { expectedRows: null, expectedCols: null } as InspectionSettings
  return {
    missing: d.hasMissingPins,
    extra: d.hasExtraPins,
    wrongColor: d.hasWrongColorPins,
    damaged: d.hasDamagedPins,
    shaft: d.hasShaftDefects,
    structure: evaluateCapture(settings ?? fallback, img).hasStructureDamage,
  }
}

export function effectiveFlags(auto: Flags, overrides: Overrides | undefined): Flags {
  return { ...auto, ...overrides }
}

export function rejects(key: DefectKey, settings: InspectionSettings | null): boolean {
  return settings ? Boolean(settings[REJECT_SETTING[key]]) : true
}

export function failingChecks(flags: Flags, settings: InspectionSettings | null): Check[] {
  return CHECKS.filter((c) => flags[c.key] && rejects(c.key, settings))
}

// Guarda só o que difere do sistema: voltar ao valor detectado desfaz a correção.
export function setOverride(current: Overrides | undefined, auto: Flags, key: DefectKey, value: boolean): Overrides {
  const next = { ...current }
  if (auto[key] === value) delete next[key]
  else next[key] = value
  return next
}

export function corrections(auto: Flags, overrides: Overrides | undefined) {
  return Object.entries(overrides ?? {}).map(([defect, corrected]) => ({
    defect: defect as DefectKey,
    detected: auto[defect as DefectKey],
    corrected: Boolean(corrected),
  }))
}

export function defectCount(img: ProcessedImage, flags: Flags, auto: Flags): number {
  const d = img.pin_classification?.details
  const detected: Record<Exclude<DefectKey, "structure">, number> = {
    missing: img.boxes_info?.empty_boxes ?? 0,
    extra: img.boxes_info?.multiple_pins_boxes ?? 0,
    wrongColor: (d?.pins_wrong_color ?? 0) + (d?.pins_double_defect ?? 0),
    damaged: (d?.pins_damaged_yellow ?? 0),
    shaft: img.shaft_classification?.rejected_shafts ?? 0,
  }
  // Defeito marcado pelo operador sem contagem do sistema vale 1; estrutura é somada pela API.
  return (Object.keys(detected) as Array<keyof typeof detected>).reduce(
    (sum, key) => sum + (flags[key] ? (auto[key] ? Math.max(detected[key], 1) : 1) : 0),
    0,
  )
}
