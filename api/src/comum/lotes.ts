// O que é derivado de um lote em vez de gravado: veredito e defeitos de cada captura, correções do operador e totais.

import { DefectType, InspectionCriteria, Prisma } from '@prisma/client';

export type Defeito = 'missing' | 'extra' | 'wrongColor' | 'damaged' | 'shaft' | 'structure';

// Chaves do contrato JSON com o frontend, que continuam iguais às do modelo anterior.
export const CHAVE_DO_DEFEITO: Record<DefectType, Defeito> = {
  MISSING: 'missing',
  EXTRA: 'extra',
  WRONG_COLOR: 'wrongColor',
  DAMAGED: 'damaged',
  SHAFT: 'shaft',
  STRUCTURE: 'structure',
};

export const TIPO_DO_DEFEITO = Object.fromEntries(
  Object.entries(CHAVE_DO_DEFEITO).map(([tipo, chave]) => [chave, tipo]),
) as Record<Defeito, DefectType>;

const CRITERIO_DO_DEFEITO = {
  MISSING: 'rejectMissingPins',
  EXTRA: 'rejectExtraPins',
  WRONG_COLOR: 'rejectWrongColorPins',
  DAMAGED: 'rejectDamagedPins',
  SHAFT: 'rejectShaftDefects',
  STRUCTURE: 'rejectStructureDamage',
} as const satisfies Record<DefectType, keyof InspectionCriteria>;

export type RegrasDeReprovacao = Pick<InspectionCriteria, (typeof CRITERIO_DO_DEFEITO)[DefectType]>;

export const REGRAS_DE_REPROVACAO = Object.fromEntries(
  Object.values(CRITERIO_DO_DEFEITO).map((campo) => [campo, true]),
) as Record<keyof RegrasDeReprovacao, true>;

interface DefeitoGravado {
  type: DefectType;
  detectedCount: number;
  present: boolean;
}

export function resultadoDaCaptura(defeitos: DefeitoGravado[], regras: RegrasDeReprovacao) {
  const presentes = defeitos.filter((d) => d.present);
  return {
    aprovada: !presentes.some((d) => regras[CRITERIO_DO_DEFEITO[d.type]]),
    // Defeito marcado pelo operador sem contagem do sistema vale 1.
    quantidade: presentes.reduce((soma, d) => soma + Math.max(d.detectedCount, 1), 0),
    defeitos: Object.fromEntries(
      Object.entries(CHAVE_DO_DEFEITO).map(([tipo, chave]) => [chave, presentes.some((d) => d.type === tipo)]),
    ) as Record<Defeito, boolean>,
    correcoes: defeitos
      .filter((d) => d.detectedCount > 0 !== d.present)
      .map((d) => ({ defect: CHAVE_DO_DEFEITO[d.type], detected: d.detectedCount > 0, corrected: d.present })),
    tipos: presentes.map((d) => d.type),
  };
}

export function percentual(parte: number, total: number): number | null {
  return total > 0 ? (parte / total) * 100 : null;
}

// Tudo que um lote precisa trazer do banco para ser resumido.
export const LOTE_COMPLETO = {
  author: { select: { matricula: true, name: true } },
  unit: { select: { id: true, name: true } },
  criteria: { select: REGRAS_DE_REPROVACAO },
  captures: { select: { defects: { select: { type: true, detectedCount: true, present: true } } } },
} satisfies Prisma.BatchInclude;

export type LoteCompleto = Prisma.BatchGetPayload<{ include: typeof LOTE_COMPLETO }>;

export function totaisDoLote(lote: Pick<LoteCompleto, 'captures' | 'criteria'>) {
  const resultados = lote.captures.map((c) => resultadoDaCaptura(c.defects, lote.criteria));
  const aprovadas = resultados.filter((r) => r.aprovada).length;
  return {
    capturas: resultados.length,
    aprovadas,
    defeitos: resultados.reduce((soma, r) => soma + r.quantidade, 0),
    tiposPorCaptura: resultados.map((r) => r.tipos),
  };
}

// Formato único de lote nas listas (lotes, coletas e dashboard), para o frontend ter um só tipo.
export function loteResumido(lote: LoteCompleto) {
  const totais = totaisDoLote(lote);
  return {
    id: lote.id,
    name: lote.name,
    description: lote.description,
    created_at: lote.createdAt.toISOString(),
    author: lote.author,
    unit: lote.unit,
    total_captures: totais.capturas,
    valid_captures: totais.aprovadas,
    invalid_captures: totais.capturas - totais.aprovadas,
    total_defects: totais.defeitos,
    quality_score: percentual(totais.aprovadas, totais.capturas) ?? 0,
  };
}
