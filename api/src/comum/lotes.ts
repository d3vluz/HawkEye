// Cálculos usados tanto na listagem de lotes quanto no dashboard.

import { BancoService } from '../banco/banco.service';

export function percentual(parte: number, total: number): number | null {
  return total > 0 ? (parte / total) * 100 : null;
}

export async function nomesDosAutores(banco: BancoService, matriculas: Array<string | null>) {
  const unicas = [...new Set(matriculas.filter((m): m is string => m !== null))];
  const membros = await banco.member.findMany({ where: { matricula: { in: unicas } }, select: { matricula: true, name: true } });
  return new Map(membros.map((m) => [m.matricula!, m.name]));
}

export function autor(matricula: string | null, nomes: Map<string, string>) {
  return matricula ? { matricula, name: nomes.get(matricula) ?? null } : null;
}

interface LoteDoBanco {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  authorMatricula: string | null;
  totalCaptures: number;
  validCaptures: number;
  unit: { id: string; name: string } | null;
}

// Formato único de lote nas listas (lotes, coletas e dashboard), para o frontend ter um só tipo.
export function loteResumido(lote: LoteDoBanco, nomes: Map<string, string>, defeitos: number) {
  return {
    id: lote.id,
    name: lote.name,
    description: lote.description,
    created_at: lote.createdAt.toISOString(),
    author: autor(lote.authorMatricula, nomes),
    unit: lote.unit,
    total_captures: lote.totalCaptures,
    valid_captures: lote.validCaptures,
    invalid_captures: lote.totalCaptures - lote.validCaptures,
    total_defects: defeitos,
    quality_score: percentual(lote.validCaptures, lote.totalCaptures) ?? 0,
  };
}
