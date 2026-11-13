// Números do dashboard: período atual (30 dias) contra o anterior, série diária, defeitos, linhas, operadores e lotes recentes.

import { Injectable } from '@nestjs/common';
import { DefectType } from '@prisma/client';
import { BancoService } from '../banco/banco.service';
import { LOTE_COMPLETO, LoteCompleto, loteResumido, percentual, totaisDoLote } from '../comum/lotes';
import { CriteriosService } from '../configuracoes/criterios.service';

const DIAS_DO_PERIODO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
// Os dias do gráfico seguem o relógio da fábrica, não o UTC do container.
const chaveDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

const TIPOS_DE_DEFEITO: Array<{ key: string; label: string; tipo: DefectType }> = [
  { key: 'missingPins', label: 'Pino ausente', tipo: 'MISSING' },
  { key: 'extraPins', label: 'Pino extra', tipo: 'EXTRA' },
  { key: 'damagedPins', label: 'Pino danificado', tipo: 'DAMAGED' },
  { key: 'wrongColorPins', label: 'Cor incorreta', tipo: 'WRONG_COLOR' },
  { key: 'structureDamage', label: 'Dano estrutural', tipo: 'STRUCTURE' },
  { key: 'shaftDefects', label: 'Defeito na haste', tipo: 'SHAFT' },
];

type Totais = ReturnType<typeof totaisDoLote>;

class Acumulado {
  lotes = 0;
  capturas = 0;
  aprovadas = 0;
  defeitos = 0;
  abaixoDaMeta = 0;
  porTipo = Object.fromEntries(TIPOS_DE_DEFEITO.map((d) => [d.tipo, 0])) as Record<DefectType, number>;

  somar(totais: Totais, abaixoDaMeta: boolean) {
    this.lotes += 1;
    this.capturas += totais.capturas;
    this.aprovadas += totais.aprovadas;
    this.defeitos += totais.defeitos;
    if (abaixoDaMeta) this.abaixoDaMeta += 1;
    // Conta capturas com cada defeito, não ocorrências.
    for (const tipos of totais.tiposPorCaptura) for (const tipo of new Set(tipos)) this.porTipo[tipo] += 1;
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

function somarEm<K>(mapa: Map<K, Acumulado>, chave: K, totais: Totais, abaixoDaMeta: boolean) {
  const acumulado = mapa.get(chave) ?? new Acumulado();
  acumulado.somar(totais, abaixoDaMeta);
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

    const [criterios, lotesDaJanela, linhas, historico] = await Promise.all([
      this.criterios.vigentes(),
      this.banco.batch.findMany({
        where: { createdAt: { gte: new Date(agora - (DIAS_DO_PERIODO * 2 + 1) * DIA_MS) } },
        include: LOTE_COMPLETO,
      }),
      this.banco.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.banco.batch.findMany({ where: { unitId: linhaId }, orderBy: { createdAt: 'desc' }, include: LOTE_COMPLETO }),
    ]);

    const meta = criterios.minQualityScore;
    const abaixoDaMeta = (t: Totais) => t.capturas > 0 && (t.aprovadas / t.capturas) * 100 < meta;
    const porDia = Array.from({ length: DIAS_DO_PERIODO }, () => ({ capturas: 0, aprovadas: 0, defeitos: 0 }));
    const atual = new Acumulado();
    const anterior = new Acumulado();
    const geral = new Acumulado();
    const porLinha = new Map<string, Acumulado>();
    const porAutor = new Map<string, { autor: LoteCompleto['author']; acumulado: Acumulado }>();

    for (const lote of historico) geral.somar(totaisDoLote(lote), false);

    for (const lote of lotesDaJanela) {
      const indice = indiceDoDia.get(chaveDoDia.format(lote.createdAt));
      if (indice === undefined) continue;
      const totais = totaisDoLote(lote);
      const noPeriodoAtual = indice < DIAS_DO_PERIODO;
      // A comparação entre linhas ignora o filtro de linha, para mostrar todas lado a lado.
      if (noPeriodoAtual) somarEm(porLinha, lote.unitId, totais, abaixoDaMeta(totais));
      if (linhaId && lote.unitId !== linhaId) continue;

      (noPeriodoAtual ? atual : anterior).somar(totais, abaixoDaMeta(totais));
      if (!noPeriodoAtual) continue;
      porDia[indice].capturas += totais.capturas;
      porDia[indice].aprovadas += totais.aprovadas;
      porDia[indice].defeitos += totais.defeitos;
      const doAutor = porAutor.get(lote.authorId) ?? { autor: lote.author, acumulado: new Acumulado() };
      doAutor.acumulado.somar(totais, abaixoDaMeta(totais));
      porAutor.set(lote.authorId, doAutor);
    }

    const maisAtivos = [...porAutor.values()].sort((a, b) => b.acumulado.capturas - a.acumulado.capturas).slice(0, 5);
    const totalGeral = geral.resumo();

    return {
      periodDays: DIAS_DO_PERIODO,
      qualityTarget: meta,
      totals: { batches: totalGeral.batches, captures: totalGeral.captures, approvalRate: totalGeral.approvalRate },
      current: atual.resumo(),
      previous: anterior.resumo(),
      series: porDia.reverse().map((dia, i) => ({
        date: dias[DIAS_DO_PERIODO - 1 - i],
        captures: dia.capturas,
        approvalRate: percentual(dia.aprovadas, dia.capturas),
        defectsPerCapture: dia.capturas > 0 ? dia.defeitos / dia.capturas : null,
      })),
      defectsByType: TIPOS_DE_DEFEITO.map(({ key, label, tipo }) => ({
        key,
        label,
        captures: atual.porTipo[tipo],
        share: percentual(atual.porTipo[tipo], atual.capturas),
        previousShare: percentual(anterior.porTipo[tipo], anterior.capturas),
      })).sort((a, b) => b.captures - a.captures),
      units: linhas.map((l) => ({ id: l.id, name: l.name, ...(porLinha.get(l.id) ?? new Acumulado()).resumo() })),
      operators: maisAtivos.map(({ autor, acumulado }) => ({ ...autor, ...acumulado.resumo() })),
      recentBatches: historico.slice(0, 8).map(loteResumido),
    };
  }
}
