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
