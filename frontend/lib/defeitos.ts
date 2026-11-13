// Defeitos de uma captura: o que o worker apontou, as correções do operador e o veredito pelos critérios.

import type { Camada, Criterios, Defeito, Defeitos, ResultadoDaAnalise } from "@/types"
import { plural } from "@/lib/formato"

export type Correcoes = Partial<Defeitos>

export interface Verificacao {
  defeito: Defeito
  titulo: string
  camada: Camada
  encontrado: (analise: ResultadoDaAnalise, criterios: Criterios | null) => string
  semDefeito: string
}

const CRITERIO_DO_DEFEITO: Record<Defeito, keyof Criterios> = {
  missing: "rejectMissingPins",
  extra: "rejectExtraPins",
  wrongColor: "rejectWrongColorPins",
  damaged: "rejectDamagedPins",
  shaft: "rejectShaftDefects",
  structure: "rejectStructureDamage",
}

// Quantas ocorrências de cada defeito o sistema detectou. Pino com cor errada e deformado conta nas duas.
export function contagensDetectadas(analise: ResultadoDaAnalise): Record<Exclude<Defeito, "structure">, number> {
  const pinos = analise.pin_classification.details
  return {
    missing: analise.boxes_info.empty_boxes,
    extra: analise.boxes_info.multiple_pins_boxes,
    wrongColor: pinos.pins_wrong_color + pinos.pins_double_defect,
    damaged: pinos.pins_damaged_yellow + pinos.pins_double_defect,
    shaft: analise.shaft_classification.rejected_shafts,
  }
}

export const VERIFICACOES: Verificacao[] = [
  {
    defeito: "missing", titulo: "Pino faltando", camada: "boxes",
    encontrado: (a) => plural(contagensDetectadas(a).missing, "compartimento vazio", "compartimentos vazios"),
    semDefeito: "Todos os compartimentos têm pino",
  },
  {
    defeito: "extra", titulo: "Pino a mais", camada: "boxes",
    encontrado: (a) => plural(contagensDetectadas(a).extra, "compartimento com pino sobrando", "compartimentos com pino sobrando"),
    semDefeito: "Nenhum compartimento com pino sobrando",
  },
  {
    defeito: "wrongColor", titulo: "Cor do pino", camada: "pins",
    encontrado: (a) => plural(contagensDetectadas(a).wrongColor, "pino fora da cor padrão", "pinos fora da cor padrão"),
    semDefeito: "Todos na cor padrão",
  },
  {
    defeito: "damaged", titulo: "Corpo do pino", camada: "pins",
    encontrado: (a) => plural(contagensDetectadas(a).damaged, "pino deformado ou lascado", "pinos deformados ou lascados"),
    semDefeito: "Nenhum pino deformado",
  },
  {
    defeito: "shaft", titulo: "Haste (agulha)", camada: "shafts",
    encontrado: (a) => plural(contagensDetectadas(a).shaft, "haste quebrada, curta ou torta", "hastes quebradas, curtas ou tortas"),
    semDefeito: "Todas as hastes íntegras",
  },
  {
    defeito: "structure", titulo: "Estrutura da caixa", camada: "areas",
    encontrado: (a, criterios) => {
      if (a.missing_dividers.length > 0) return plural(a.missing_dividers.length, "divisória ausente", "divisórias ausentes")
      if (criterios?.expectedRows && criterios.expectedCols) {
        return `Grade ${a.grid_rows}×${a.grid_cols}, esperado ${criterios.expectedRows}×${criterios.expectedCols}`
      }
      return "Grade fora do padrão"
    },
    semDefeito: "Divisórias e grade conferem",
  },
]

export const camadaDoDefeito = (defeito: Defeito) => VERIFICACOES.find((v) => v.defeito === defeito)!.camada

// Espelha a regra da API (configuracoes/criterios.service.ts) só para exibir; o veredito gravado é o do servidor.
export function defeitosDetectados(analise: ResultadoDaAnalise, criterios: Criterios | null): Defeitos {
  const q = contagensDetectadas(analise)
  const temGradeEsperada = criterios?.expectedRows != null && criterios?.expectedCols != null
  const estrutura =
    analise.areas_count < analise.grid_rows * analise.grid_cols ||
    (temGradeEsperada && (analise.grid_rows !== criterios!.expectedRows || analise.grid_cols !== criterios!.expectedCols))
  return {
    missing: q.missing > 0,
    extra: q.extra > 0,
    wrongColor: q.wrongColor > 0,
    damaged: q.damaged > 0,
    shaft: q.shaft > 0,
    structure: estrutura,
  }
}

export function reprova(defeito: Defeito, criterios: Criterios | null): boolean {
  return criterios ? Boolean(criterios[CRITERIO_DO_DEFEITO[defeito]]) : true
}

export function verificacoesReprovadas(defeitos: Defeitos, criterios: Criterios | null): Verificacao[] {
  return VERIFICACOES.filter((v) => defeitos[v.defeito] && reprova(v.defeito, criterios))
}

// Guarda só o que difere do sistema: voltar ao valor detectado desfaz a correção.
export function corrigir(atuais: Correcoes | undefined, detectados: Defeitos, defeito: Defeito, valor: boolean): Correcoes {
  const proximas = { ...atuais }
  if (detectados[defeito] === valor) delete proximas[defeito]
  else proximas[defeito] = valor
  return proximas
}
