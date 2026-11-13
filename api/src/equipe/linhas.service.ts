// Linhas de produção (unidades): cadastro, linhas de cada membro e as três linhas criadas no primeiro uso.

import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { BancoService } from '../banco/banco.service';

const LINHAS_INICIAIS = ['Linha A', 'Linha B', 'Linha C'];

@Injectable()
export class LinhasService implements OnModuleInit {
  constructor(private banco: BancoService) {}

  async onModuleInit() {
    if ((await this.banco.unit.count()) > 0) return;
    await this.banco.unit.createMany({ data: LINHAS_INICIAIS.map((name) => ({ name })) });
  }

  async listar() {
    const linhas = await this.banco.unit.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { batches: true } } },
    });

    const membrosPorLinha = await Promise.all(
      linhas.map((linha) => this.banco.member.count({
        where: { status: 'ACTIVE', OR: [{ allUnits: true }, { units: { some: { unitId: linha.id } } }] },
      })),
    );
    return linhas.map(({ _count, ...linha }, i) => ({ ...linha, memberCount: membrosPorLinha[i], batchCount: _count.batches }));
  }

  async doMembro(membroId: string) {
    const membro = await this.banco.member.findUnique({ where: { id: membroId }, select: { allUnits: true } });
    if (!membro) return [];
    return this.banco.unit.findMany({
      where: membro.allUnits ? undefined : { members: { some: { memberId: membroId } } },
      orderBy: { name: 'asc' },
    });
  }

  async criar(nome: string) {
    return this.banco.unit.create({ data: { name: await this.nomeDisponivel(nome) } });
  }

  async renomear(id: string, nome: string) {
    await this.buscar(id);
    return this.banco.unit.update({ where: { id }, data: { name: await this.nomeDisponivel(nome, id) } });
  }

  async remover(id: string) {
    const linha = await this.buscar(id);
    if ((await this.banco.batch.count({ where: { unitId: id } })) > 0) {
      throw new ConflictException(`${linha.name} tem lotes registrados e não pode ser removida. Renomeie, se precisar.`);
    }
    await this.banco.unit.delete({ where: { id } });
    return { success: true };
  }

  private async buscar(id: string) {
    const linha = await this.banco.unit.findUnique({ where: { id } });
    if (!linha) throw new NotFoundException('Linha não encontrada');
    return linha;
  }

  private async nomeDisponivel(nome: string, excetoId?: string) {
    const limpo = nome.trim();
    const existente = await this.banco.unit.findFirst({
      where: { name: { equals: limpo, mode: 'insensitive' }, id: excetoId ? { not: excetoId } : undefined },
    });
    if (existente) throw new ConflictException('Já existe uma linha com esse nome');
    return limpo;
  }
}
