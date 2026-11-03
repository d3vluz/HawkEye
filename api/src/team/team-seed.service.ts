import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamSeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if ((await this.prisma.unit.count()) > 0) return;

    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };

    const [linhaA, , linhaC] = await Promise.all([
      this.prisma.unit.create({ data: { name: 'Linha A' } }),
      this.prisma.unit.create({ data: { name: 'Linha B' } }),
      this.prisma.unit.create({ data: { name: 'Linha C' } }),
    ]);

    await this.prisma.member.create({
      data: { name: 'Rafael Costa', matricula: '1001', email: 'rafael@hawkeye.com.br', allUnits: true, lastAccessAt: new Date() },
    });
    await this.prisma.member.create({
      data: { name: 'Lara Nunes', matricula: '1002', email: 'lara@hawkeye.com.br', allUnits: true, lastAccessAt: new Date() },
    });
    await this.prisma.member.create({
      data: {
        name: 'Diego Alves',
        matricula: '1003',
        email: 'diego@hawkeye.com.br',
        lastAccessAt: daysAgo(2),
        units: { connect: [{ id: linhaA.id }] },
      },
    });
    await this.prisma.member.create({
      data: {
        name: 'Carla Souza',
        matricula: '1004',
        email: 'carla@hawkeye.com.br',
        lastAccessAt: new Date(),
        units: { connect: [{ id: linhaC.id }] },
      },
    });
  }
}
