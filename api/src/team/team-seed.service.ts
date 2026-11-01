import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamSeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.member.count();
    if (existing > 0) return;

    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };

    const [central, linhaA, linhaB] = await Promise.all([
      this.prisma.unit.create({ data: { name: 'Planta Central' } }),
      this.prisma.unit.create({ data: { name: 'Linha A' } }),
      this.prisma.unit.create({ data: { name: 'Linha B' } }),
    ]);

    await this.prisma.member.create({
      data: { name: 'Rafael Costa', email: 'rafael@hawkeye.com.br', allUnits: true, lastAccessAt: new Date() },
    });
    await this.prisma.member.create({
      data: { name: 'Lara Nunes', email: 'lara@hawkeye.com.br', allUnits: true, lastAccessAt: new Date() },
    });
    await this.prisma.member.create({
      data: {
        name: 'Diego Alves',
        email: 'diego@hawkeye.com.br',
        lastAccessAt: daysAgo(2),
        units: { connect: [{ id: linhaA.id }] },
      },
    });
    await this.prisma.member.create({
      data: {
        name: 'Carla Souza',
        email: 'carla@hawkeye.com.br',
        lastAccessAt: new Date(),
        units: { connect: [{ id: central.id }] },
      },
    });

    await this.prisma.invite.create({
      data: { name: 'Bruno Lima', email: 'bruno@hawkeye.com.br', units: { connect: [{ id: linhaB.id }] } },
    });
    await this.prisma.invite.create({
      data: { email: 'convidado@hawkeye.com.br', allUnits: true },
    });
  }
}
