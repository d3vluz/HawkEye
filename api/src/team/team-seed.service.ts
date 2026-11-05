import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_UNITS = ['Linha A', 'Linha B', 'Linha C'];

@Injectable()
export class TeamSeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if ((await this.prisma.unit.count()) > 0) return;
    await this.prisma.unit.createMany({ data: DEFAULT_UNITS.map((name) => ({ name })) });
  }
}
