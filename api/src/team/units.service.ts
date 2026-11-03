import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const units = await this.prisma.unit.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { batches: true } } },
    });
    // Quem tem "todas as unidades" conta em cada linha, sem contar duas vezes quem também tem vínculo direto.
    const memberCounts = await Promise.all(
      units.map((unit) =>
        this.prisma.member.count({ where: { OR: [{ allUnits: true }, { units: { some: { id: unit.id } } }] } }),
      ),
    );
    return units.map(({ _count, ...unit }, i) => ({
      ...unit,
      memberCount: memberCounts[i],
      batchCount: _count.batches,
    }));
  }

  async findForMember(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId }, include: { units: true } });
    if (!member) return [];
    if (member.allUnits) return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
    return member.units.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(name: string) {
    const trimmed = await this.assertNameAvailable(name);
    return this.prisma.unit.create({ data: { name: trimmed } });
  }

  async rename(id: string, name: string) {
    await this.findOrThrow(id);
    const trimmed = await this.assertNameAvailable(name, id);
    return this.prisma.unit.update({ where: { id }, data: { name: trimmed } });
  }

  async remove(id: string) {
    const unit = await this.findOrThrow(id);
    const batches = await this.prisma.batch.count({ where: { unitId: id } });
    if (batches > 0) {
      throw new ConflictException(`${unit.name} tem lotes registrados e não pode ser removida. Renomeie, se precisar.`);
    }
    await this.prisma.unit.delete({ where: { id } });
    return { success: true };
  }

  private async findOrThrow(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unidade não encontrada');
    return unit;
  }

  private async assertNameAvailable(name: string, exceptId?: string) {
    const trimmed = name.trim();
    const existing = await this.prisma.unit.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' }, id: exceptId ? { not: exceptId } : undefined },
    });
    if (existing) throw new ConflictException('Já existe uma unidade com esse nome');
    return trimmed;
  }
}
