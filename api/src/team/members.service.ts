import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Member, Prisma, Unit } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

type MemberWithUnits = Member & { units: Unit[] };

function toPublicMember({ passwordHash, tokenVersion, ...member }: MemberWithUnits) {
  return { ...member, hasPassword: passwordHash !== null };
}

const DUPLICATE_MEMBER_MESSAGE = 'Matrícula ou e-mail já cadastrado';

function isDuplicateMember(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const members = await this.prisma.member.findMany({
      orderBy: { createdAt: 'asc' },
      include: { units: true },
    });
    return members.map(toPublicMember);
  }

  async create(dto: CreateMemberDto) {
    const allUnits = dto.allUnits ?? false;
    try {
      const member = await this.prisma.member.create({
        data: {
          name: dto.name,
          matricula: dto.matricula.trim().toLowerCase(),
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone,
          allUnits,
          passwordHash: await argon2.hash(dto.temporaryPassword),
          units: allUnits ? undefined : { connect: (dto.unitIds ?? []).map((id) => ({ id })) },
        },
        include: { units: true },
      });
      return toPublicMember(member);
    } catch (error) {
      if (isDuplicateMember(error)) throw new ConflictException(DUPLICATE_MEMBER_MESSAGE);
      throw error;
    }
  }

  async update(id: string, dto: UpdateMemberDto, actorId: string) {
    const current = await this.findOrThrow(id);
    const revokesAccess =
      (dto.role !== undefined && dto.role !== current.role) ||
      (dto.status !== undefined && dto.status !== current.status);

    // Como quem age é sempre um admin ativo, bloquear a própria conta também
    // garante que o sistema nunca fica sem nenhum admin.
    if (revokesAccess && id === actorId) {
      throw new BadRequestException('Você não pode alterar o próprio perfil ou status');
    }

    try {
      const member = await this.prisma.member.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email?.trim().toLowerCase() ?? dto.email,
          phone: dto.phone,
          role: dto.role,
          status: dto.status,
          allUnits: dto.allUnits,
          tokenVersion: revokesAccess ? { increment: 1 } : undefined,
          units: dto.unitIds ? { set: dto.unitIds.map((uid) => ({ id: uid })) } : undefined,
        },
        include: { units: true },
      });
      return toPublicMember(member);
    } catch (error) {
      if (isDuplicateMember(error)) throw new ConflictException(DUPLICATE_MEMBER_MESSAGE);
      throw error;
    }
  }

  async resetPassword(id: string, temporaryPassword: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Use a troca de senha da sua própria conta');
    await this.findOrThrow(id);

    const member = await this.prisma.member.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(temporaryPassword),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
      include: { units: true },
    });
    return toPublicMember(member);
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Você não pode remover a própria conta');
    await this.findOrThrow(id);
    await this.prisma.member.delete({ where: { id } });
    return { success: true };
  }

  private async findOrThrow(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return member;
  }
}
