import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.member.findMany({
      orderBy: { createdAt: 'asc' },
      include: { units: true },
    });
  }

  create(dto: CreateMemberDto) {
    const allUnits = dto.allUnits ?? false;
    return this.prisma.member.create({
      data: {
        name: dto.name,
        email: dto.email,
        allUnits,
        lastAccessAt: new Date(),
        units: allUnits ? undefined : { connect: (dto.unitIds ?? []).map((id) => ({ id })) },
      },
      include: { units: true },
    });
  }

  async update(id: string, dto: UpdateMemberDto) {
    await this.ensureExists(id);
    return this.prisma.member.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        allUnits: dto.allUnits,
        units: dto.unitIds ? { set: dto.unitIds.map((uid) => ({ id: uid })) } : undefined,
      },
      include: { units: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.member.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.member.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Membro não encontrado');
  }
}
