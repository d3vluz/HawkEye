import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { units: true },
    });
  }

  create(dto: CreateInviteDto) {
    const allUnits = dto.allUnits ?? false;
    return this.prisma.invite.create({
      data: {
        name: dto.name,
        email: dto.email,
        allUnits,
        units: allUnits ? undefined : { connect: (dto.unitIds ?? []).map((id) => ({ id })) },
      },
      include: { units: true },
    });
  }

  async cancel(id: string) {
    await this.ensureExists(id);
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
  }

  async resend(id: string) {
    await this.ensureExists(id);
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'PENDING', createdAt: new Date(), respondedAt: null },
    });
  }

  async accept(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
      include: { units: true },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          name: invite.name ?? invite.email.split('@')[0],
          email: invite.email,
          allUnits: invite.allUnits,
          lastAccessAt: new Date(),
          units: invite.allUnits
            ? undefined
            : { connect: invite.units.map((u) => ({ id: u.id })) },
        },
        include: { units: true },
      });
      await tx.invite.update({
        where: { id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      return member;
    });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.invite.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Convite não encontrado');
  }
}
