import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators';

@Roles('ADMIN')
@Controller('api/team')
export class TeamController {
  constructor(private prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [members, activeToday, units] = await Promise.all([
      this.prisma.member.count(),
      this.prisma.member.count({ where: { lastAccessAt: { gte: startOfToday } } }),
      this.prisma.unit.count(),
    ]);

    return { members, activeToday, units };
  }
}
