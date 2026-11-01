import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/team')
export class TeamController {
  constructor(private prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [members, activeToday, pendingInvites, units] = await Promise.all([
      this.prisma.member.count(),
      this.prisma.member.count({ where: { lastAccessAt: { gte: startOfToday } } }),
      this.prisma.invite.count({ where: { status: 'PENDING' } }),
      this.prisma.unit.count(),
    ]);

    return { members, activeToday, pendingInvites, units };
  }
}
