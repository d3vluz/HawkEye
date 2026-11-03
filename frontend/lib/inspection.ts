import type { InspectionSettings } from "@/lib/api-client"

export interface WorkerResult {
  areas_count: number
  grid_rows?: number
  grid_cols?: number
  boxes_info?: { empty_boxes?: number; multiple_pins_boxes?: number }
  pin_classification?: { details?: { pins_wrong_color?: number; pins_damaged_yellow?: number; pins_double_defect?: number } }
  shaft_classification?: { rejected_shafts?: number }
}

export function detectedDefects(result: WorkerResult) {
  const details = result.pin_classification?.details
  const doubleDefect = details?.pins_double_defect || 0
  return {
    hasMissingPins: (result.boxes_info?.empty_boxes || 0) > 0,
    hasExtraPins: (result.boxes_info?.multiple_pins_boxes || 0) > 0,
    hasDamagedPins: (details?.pins_damaged_yellow || 0) + doubleDefect > 0,
    hasWrongColorPins: (details?.pins_wrong_color || 0) + doubleDefect > 0,
    hasShaftDefects: (result.shaft_classification?.rejected_shafts || 0) > 0,
  }
}

// Espelha o veredito da API só para exibir na revisão; o que vale é o calculado no servidor.
export function evaluateCapture(settings: InspectionSettings, result: WorkerResult) {
  const flags = detectedDefects(result)
  const { expectedRows, expectedCols } = settings
  const hasStructureDamage =
    expectedRows !== null && expectedCols !== null &&
    (result.grid_rows === undefined || result.grid_cols === undefined
      ? result.areas_count !== expectedRows * expectedCols
      : result.grid_rows !== expectedRows || result.grid_cols !== expectedCols)

  const rejected =
    (settings.rejectMissingPins && flags.hasMissingPins) ||
    (settings.rejectExtraPins && flags.hasExtraPins) ||
    (settings.rejectDamagedPins && flags.hasDamagedPins) ||
    (settings.rejectWrongColorPins && flags.hasWrongColorPins) ||
    (settings.rejectShaftDefects && flags.hasShaftDefects) ||
    (settings.rejectStructureDamage && hasStructureDamage)

  return { isValid: !rejected, hasStructureDamage }
}
