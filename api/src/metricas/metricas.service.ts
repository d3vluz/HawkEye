// Números do dashboard: período atual (30 dias) contra o anterior, série diária, defeitos, linhas, operadores e lotes recentes.

import { Injectable } from '@nestjs/common';
import { BancoService } from '../banco/banco.service';
import { loteResumido, nomesDosAutores, percentual } from '../comum/lotes';
import { CriteriosService } from '../configuracoes/criterios.service';

const DIAS_DO_PERIODO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
// Os dias do gráfico seguem o relógio da fábrica, não o UTC do container.
const chaveDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

const TIPOS_DE_DEFEITO = [
  { key: 'missingPins', label: 'Pino ausente', field: 'hasMissingPins' },
  { key: 'extraPins', label: 'Pino extra', field: 'hasExtraPins' },
  { key: 'damagedPins', label: 'Pino danificado', field: 'hasDamagedPins' },
  { key: 'wrongColorPins', label: 'Cor incorreta', field: 'hasWrongColorPins' },
  { key: 'structureDamage', label: 'Dano estrutural', field: 'hasStructureDamage' },
  { key: 'shaftDefects', label: 'Defeito na haste', field: 'hasShaftDefects' },
] as const;

type CampoDeDefeito = (typeof TIPOS_DE_DEFEITO)[number]['field'];
type Captura = { isValid: boolean; defectsCount: number } & Record<CampoDeDefeito, boolean>;
type Lote = {
  createdAt: Date;
  unitId: string | null;
  authorMatricula: string | null;
  totalCaptures: number;
  validCaptures: number;
  captures: Captura[];
};

class Acumulado {
  lotes = 0;
  capturas = 0;
  aprovadas = 0;
  defeitos = 0;
  abaixoDaMeta = 0;
  porTipo = Object.fromEntries(TIPOS_DE_DEFEITO.map((d) => [d.field, 0])) as Record<CampoDeDefeito, number>;

  somar(lote: Lote, abaixoDaMeta: boolean) {
    this.lotes += 1;
    this.capturas += lote.totalCaptures;
    this.aprovadas += lote.validCaptures;
    if (abaixoDaMeta) this.abaixoDaMeta += 1;
    for (const captura of lote.captures) {
      this.defeitos += captura.defectsCount;
      for (const { field } of TIPOS_DE_DEFEITO) if (captura[field]) this.porTipo[field] += 1;
    }
  }

  resumo() {
    return {
      batches: this.lotes,
      captures: this.capturas,
      approvalRate: percentual(this.aprovadas, this.capturas),
      defectsPerCapture: this.capturas > 0 ? this.defeitos / this.capturas : null,
      belowTarget: this.abaixoDaMeta,
    };
  }
}

function somarEm<K>(mapa: Map<K, Acumulado>, chave: K, lote: Lote, abaixoDaMeta: boolean) {
  const acumulado = mapa.get(chave) ?? new Acumulado();
  acumulado.somar(lote, abaixoDaMeta);
  mapa.set(chave, acumulado);
}

@Injectable()
export class MetricasService {
  constructor(
    private banco: BancoService,
    private criterios: CriteriosService,
  ) {}

  async dashboard(linhaId?: string) {
    const agora = Date.now();
    // Índice 0 = hoje; 0..29 é o período atual e 30..59 o anterior.
    const dias = Array.from({ length: DIAS_DO_PERIODO * 2 }, (_, i) => chaveDoDia.format(new Date(agora - i * DIA_MS)));
    const indiceDoDia = new Map(dias.map((dia, i) => [dia, i]));

    const [criterios, lotesDaJanela, linhas, historico, recentes] = await Promise.all([
      this.criterios.ler(),
      this.banco.batch.findMany({
        where: { createdAt: { gte: new Date(agora - (DIAS_DO_PERIODO * 2 + 1) * DIA_MS) } },
        select: {
          createdAt: true, unitId: true, authorMatricula: true, totalCaptures: true, validCaptures: true,
          captures: { select: { isValid: true, defectsCount: true, ...Object.fromEntries(TIPOS_DE_DEFEITO.map((d) => [d.field, true])) } },
        },
      }) as Promise<Lote[]>,
      this.banco.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.banco.batch.aggregate({ where: { unitId: linhaId }, _count: true, _sum: { totalCaptures: true, validCaptures: true } }),
      this.banco.batch.findMany({
        where: { unitId: linhaId },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { unit: { select: { id: true, name: true } }, captures: { select: { defectsCount: true } } },
      }),
    ]);

    const meta = criterios.minQualityScore;
    const abaixoDaMeta = (l: Lote) => l.totalCaptures > 0 && (l.validCaptures / l.totalCaptures) * 100 < meta;
    const porDia = Array.from({ length: DIAS_DO_PERIODO }, () => ({ capturas: 0, aprovadas: 0, defeitos: 0 }));
    const atual = new Acumulado();
    const anterior = new Acumulado();
    const porLinha = new Map<string | null, Acumulado>();
    const porAutor = new Map<string, Acumulado>();

    for (const lote of lotesDaJanela) {
      const indice = indiceDoDia.get(chaveDoDia.format(lote.createdAt));
      if (indice === undefined) continue;
      const noPeriodoAtual = indice < DIAS_DO_PERIODO;
      // A comparação entre linhas ignora o filtro de linha, para mostrar todas lado a lado.
      if (noPeriodoAtual) somarEm(porLinha, lote.unitId, lote, abaixoDaMeta(lote));
      if (linhaId && lote.unitId !== linhaId) continue;

      (noPeriodoAtual ? atual : anterior).somar(lote, abaixoDaMeta(lote));
      if (!noPeriodoAtual) continue;
      porDia[indice].capturas += lote.totalCaptures;
      porDia[indice].aprovadas += lote.validCaptures;
      porDia[indice].defeitos += lote.captures.reduce((soma, c) => soma + c.defectsCount, 0);
      if (lote.authorMatricula) somarEm(porAutor, lote.authorMatricula, lote, abaixoDaMeta(lote));
    }

    const maisAtivos = [...porAutor.entries()].sort((a, b) => b[1].capturas - a[1].capturas).slice(0, 5);
    const nomes = await nomesDosAutores(this.banco, [...maisAtivos.map(([m]) => m), ...recentes.map((l) => l.authorMatricula)]);

    return {
      periodDays: DIAS_DO_PERIODO,
      qualityTarget: meta,
      totals: {
        batches: historico._count,
        captures: historico._sum.totalCaptures ?? 0,
        approvalRate: percentual(historico._sum.validCaptures ?? 0, historico._sum.totalCaptures ?? 0),
      },
      current: atual.resumo(),
      previous: anterior.resumo(),
      series: porDia.reverse().map((dia, i) => ({
        date: dias[DIAS_DO_PERIODO - 1 - i],
        captures: dia.capturas,
        approvalRate: percentual(dia.aprovadas, dia.capturas),
        defectsPerCapture: dia.capturas > 0 ? dia.defeitos / dia.capturas : null,
      })),
      defectsByType: TIPOS_DE_DEFEITO.map(({ key, label, field }) => ({
        key,
        label,
        captures: atual.porTipo[field],
        share: percentual(atual.porTipo[field], atual.capturas),
        previousShare: percentual(anterior.porTipo[field], anterior.capturas),
      })).sort((a, b) => b.captures - a.captures),
      units: [
        ...linhas.map((l) => ({ id: l.id, name: l.name, ...(porLinha.get(l.id) ?? new Acumulado()).resumo() })),
        ...(porLinha.has(null) ? [{ id: null, name: 'Sem linha', ...porLinha.get(null)!.resumo() }] : []),
      ],
      operators: maisAtivos.map(([matricula, acumulado]) => ({ matricula, name: nomes.get(matricula) ?? null, ...acumulado.resumo() })),
      recentBatches: recentes.map((l) => loteResumido(l, nomes, l.captures.reduce((soma, c) => soma + c.defectsCount, 0))),
    };
  }
}
