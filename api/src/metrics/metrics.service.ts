import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFECT_FLAGS = [
  ['Pino Ausente', 'hasMissingPins'],
  ['Pino Extra', 'hasExtraPins'],
  ['Pino Danificado', 'hasDamagedPins'],
  ['Cor Incorreta', 'hasWrongColorPins'],
  ['Dano Estrutural', 'hasStructureDamage'],
  ['Defeito na Haste', 'hasShaftDefects'],
] as const;

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const totalBatches = await this.prisma.batch.count();

    if (totalBatches === 0) {
      return { totalBatches: 0, totalImages: 0, validImages: 0, totalDefects: 0, successRate: 0, qualityScore: 0, recentBatches: [], defectsRanking: [], dailyStats: [], topDefects: [], defectTrends: [], errorDistribution: [], validityDistribution: [] };
    }

    const [batchAgg, defectAgg, recent, flagCounts] = await Promise.all([
      this.prisma.batch.aggregate({ _sum: { totalCaptures: true, validCaptures: true } }),
      this.prisma.capture.aggregate({ _sum: { defectsCount: true } }),
      this.prisma.batch.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
      Promise.all(
        DEFECT_FLAGS.map(([, field]) =>
          this.prisma.capture.count({ where: { [field]: true } as Prisma.CaptureWhereInput }),
        ),
      ),
    ]);

    const totalImages = batchAgg._sum.totalCaptures ?? 0;
    const totalValid = batchAgg._sum.validCaptures ?? 0;
    const totalDefects = defectAgg._sum.defectsCount ?? 0;
    const successRate = totalImages > 0 ? (totalValid / totalImages) * 100 : 0;

    const defectCounts: Record<string, number> = {};
    DEFECT_FLAGS.forEach(([label], i) => { defectCounts[label] = flagCounts[i]; });

    const recentIds = recent.map((b) => b.id);
    const recentDefectSums = await this.prisma.capture.groupBy({
      by: ['batchId'],
      where: { batchId: { in: recentIds } },
      _sum: { defectsCount: true },
    });
    const defectsByBatch = new Map(recentDefectSums.map((d) => [d.batchId, d._sum.defectsCount ?? 0]));

    const ranking = Object.entries(defectCounts)
      .filter(([, v]) => v > 0)
      .map(([label, count], i) => ({
        rank: i + 1,
        code: label.replace(/ /g, '_').toUpperCase(),
        label,
        count,
        severity: 2,
        percentage: totalDefects > 0 ? (count / totalDefects) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const recentBatches = recent.map((b) => ({
      id: b.id,
      name: b.name,
      totalCaptures: b.totalCaptures,
      validCaptures: b.validCaptures,
      qualityScore: b.totalCaptures > 0 ? (b.validCaptures / b.totalCaptures) * 100 : 0,
      defectCount: defectsByBatch.get(b.id) ?? 0,
    }));

    return {
      totalBatches,
      totalImages,
      validImages: totalValid,
      totalDefects,
      successRate,
      qualityScore: successRate,
      recentBatches,
      defectsRanking: ranking,
      dailyStats: [],
      topDefects: ranking.slice(0, 3),
      defectTrends: [],
      errorDistribution: Object.entries(defectCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
      validityDistribution: [
        { name: 'Válidas', value: totalValid, color: '#10b981' },
        { name: 'Com Defeito', value: totalImages - totalValid, color: '#ef4444' },
      ],
    };
  }
}
