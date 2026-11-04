import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionSettingsService } from '../settings/inspection-settings.service';

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Os dias do gráfico seguem o relógio da fábrica, não o UTC do container.
const TIME_ZONE = 'America/Sao_Paulo';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

const DEFECT_TYPES = [
  { key: 'missingPins', label: 'Pino ausente', field: 'hasMissingPins' },
  { key: 'extraPins', label: 'Pino extra', field: 'hasExtraPins' },
  { key: 'damagedPins', label: 'Pino danificado', field: 'hasDamagedPins' },
  { key: 'wrongColorPins', label: 'Cor incorreta', field: 'hasWrongColorPins' },
  { key: 'structureDamage', label: 'Dano estrutural', field: 'hasStructureDamage' },
  { key: 'shaftDefects', label: 'Defeito na haste', field: 'hasShaftDefects' },
] as const;

type DefectField = (typeof DEFECT_TYPES)[number]['field'];
type CaptureRow = { isValid: boolean; defectsCount: number } & Record<DefectField, boolean>;
type BatchRow = {
  id: string;
  createdAt: Date;
  unitId: string | null;
  authorMatricula: string | null;
  totalCaptures: number;
  validCaptures: number;
  captures: CaptureRow[];
};

interface Totals {
  batches: number;
  captures: number;
  valid: number;
  defects: number;
  belowTarget: number;
  flags: Record<DefectField, number>;
}

function emptyTotals(): Totals {
  const flags = Object.fromEntries(DEFECT_TYPES.map((d) => [d.field, 0])) as Record<DefectField, number>;
  return { batches: 0, captures: 0, valid: 0, defects: 0, belowTarget: 0, flags };
}

function rate(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : null;
}

@Injectable()
export class MetricsService {
  constructor(
    private prisma: PrismaService,
    private inspection: InspectionSettingsService,
  ) {}

  async getDashboard(unitId?: string) {
    const now = Date.now();
    // Índice 0 = hoje; 0..29 é o período atual e 30..59 o anterior.
    const days = Array.from({ length: PERIOD_DAYS * 2 }, (_, i) => dayKey.format(new Date(now - i * DAY_MS)));
    const dayIndex = new Map(days.map((key, i) => [key, i]));

    const [settings, windowBatches, units, allTime, recent] = await Promise.all([
      this.inspection.get(),
      this.prisma.batch.findMany({
        where: { createdAt: { gte: new Date(now - (PERIOD_DAYS * 2 + 1) * DAY_MS) } },
        select: {
          id: true, createdAt: true, unitId: true, authorMatricula: true, totalCaptures: true, validCaptures: true,
          captures: { select: { isValid: true, defectsCount: true, ...Object.fromEntries(DEFECT_TYPES.map((d) => [d.field, true])) } },
        },
      }) as Promise<BatchRow[]>,
      this.prisma.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.batch.aggregate({ where: { unitId }, _count: true, _sum: { totalCaptures: true, validCaptures: true } }),
      this.prisma.batch.findMany({
        where: { unitId },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { unit: { select: { id: true, name: true } }, captures: { select: { defectsCount: true } } },
      }),
    ]);

    const target = settings.minQualityScore;
    const isBelowTarget = (b: { totalCaptures: number; validCaptures: number }) =>
      b.totalCaptures > 0 && (b.validCaptures / b.totalCaptures) * 100 < target;

    const daily = Array.from({ length: PERIOD_DAYS }, () => ({ captures: 0, valid: 0, defects: 0 }));
    const current = emptyTotals();
    const previous = emptyTotals();
    const byUnit = new Map<string | null, Totals>();
    const byAuthor = new Map<string, Totals>();

    for (const batch of windowBatches) {
      const index = dayIndex.get(dayKey.format(batch.createdAt));
      if (index === undefined) continue;
      const inCurrent = index < PERIOD_DAYS;

      if (inCurrent) {
        const unit = byUnit.get(batch.unitId) ?? emptyTotals();
        this.accumulate(unit, batch, isBelowTarget(batch));
        byUnit.set(batch.unitId, unit);
      }
      if (unitId && batch.unitId !== unitId) continue;

      this.accumulate(inCurrent ? current : previous, batch, isBelowTarget(batch));
      if (!inCurrent) continue;

      const day = daily[index];
      day.captures += batch.totalCaptures;
      day.valid += batch.validCaptures;
      day.defects += batch.captures.reduce((sum, c) => sum + c.defectsCount, 0);

      if (batch.authorMatricula) {
        const author = byAuthor.get(batch.authorMatricula) ?? emptyTotals();
        this.accumulate(author, batch, isBelowTarget(batch));
        byAuthor.set(batch.authorMatricula, author);
      }
    }

    const series = daily.reverse().map((day, i) => ({
      date: days[PERIOD_DAYS - 1 - i],
      captures: day.captures,
      approvalRate: rate(day.valid, day.captures),
      defectsPerCapture: day.captures > 0 ? day.defects / day.captures : null,
    }));

    const topAuthors = [...byAuthor.entries()].sort((a, b) => b[1].captures - a[1].captures).slice(0, 5);
    const authorNames = await this.authorNames([...topAuthors.map(([m]) => m), ...recent.map((b) => b.authorMatricula)]);

    return {
      periodDays: PERIOD_DAYS,
      qualityTarget: target,
      totals: {
        batches: allTime._count,
        captures: allTime._sum.totalCaptures ?? 0,
        approvalRate: rate(allTime._sum.validCaptures ?? 0, allTime._sum.totalCaptures ?? 0),
      },
      current: this.summary(current),
      previous: this.summary(previous),
      series,
      defectsByType: DEFECT_TYPES.map(({ key, label, field }) => ({
        key,
        label,
        captures: current.flags[field],
        share: rate(current.flags[field], current.captures),
        previousShare: rate(previous.flags[field], previous.captures),
      })).sort((a, b) => b.captures - a.captures),
      units: [
        ...units.map((u) => ({ id: u.id, name: u.name, ...this.summary(byUnit.get(u.id) ?? emptyTotals()) })),
        ...(byUnit.has(null) ? [{ id: null, name: 'Sem linha', ...this.summary(byUnit.get(null)!) }] : []),
      ],
      operators: topAuthors.map(([matricula, totals]) => ({
        matricula,
        name: authorNames.get(matricula) ?? null,
        ...this.summary(totals),
      })),
      recentBatches: recent.map((b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt.toISOString(),
        unit: b.unit,
        author: b.authorMatricula ? { matricula: b.authorMatricula, name: authorNames.get(b.authorMatricula) ?? null } : null,
        captures: b.totalCaptures,
        approvalRate: rate(b.validCaptures, b.totalCaptures),
        defects: b.captures.reduce((sum, c) => sum + c.defectsCount, 0),
      })),
    };
  }

  private accumulate(totals: Totals, batch: BatchRow, belowTarget: boolean) {
    totals.batches += 1;
    totals.captures += batch.totalCaptures;
    totals.valid += batch.validCaptures;
    if (belowTarget) totals.belowTarget += 1;
    for (const capture of batch.captures) {
      totals.defects += capture.defectsCount;
      for (const { field } of DEFECT_TYPES) if (capture[field]) totals.flags[field] += 1;
    }
  }

  private summary(t: Totals) {
    return {
      batches: t.batches,
      captures: t.captures,
      approvalRate: rate(t.valid, t.captures),
      defectsPerCapture: t.captures > 0 ? t.defects / t.captures : null,
      belowTarget: t.belowTarget,
    };
  }

  private async authorNames(matriculas: Array<string | null>) {
    const unique = [...new Set(matriculas.filter((m): m is string => m !== null))];
    const members = await this.prisma.member.findMany({
      where: { matricula: { in: unique } },
      select: { matricula: true, name: true },
    });
    return new Map(members.map((m) => [m.matricula!, m.name]));
  }
}
