import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Member, MemberRole } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMember } from './decorators';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export const SESSION_COOKIE = 'hawkeye_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Credenciais fixas por decisão do projeto: acesso imediato após subir a stack.
const DEFAULT_ACCOUNTS = [
  { matricula: 'admin', password: 'admin', name: 'Evandro Luz', role: MemberRole.ADMIN, githubUsername: 'd3vluz' },
  { matricula: 'user', password: 'user', name: 'Funcionário', role: MemberRole.EMPLOYEE },
];

export interface SessionPayload {
  sub: string;
  role: MemberRole;
  mustChangePassword: boolean;
  tokenVersion: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash: string;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash(randomBytes(32).toString('hex'));
    await this.ensureDefaultAccounts();
  }

  get cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
    };
  }

  get sessionMaxAge() {
    return SESSION_TTL_MS;
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const member = await this.prisma.member.findFirst({
      where: { OR: [{ matricula: identifier }, { email: identifier }] },
    });

    // Verifica mesmo sem conta para o tempo de resposta não revelar quais e-mails existem.
    const valid = await argon2.verify(member?.passwordHash ?? this.dummyHash, dto.password);
    if (!member?.passwordHash || !valid || member.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credencial ou senha inválidas');
    }

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { lastAccessAt: new Date() },
    });
    return this.buildSession(updated);
  }

  async changePassword(current: SessionMember, dto: ChangePasswordDto) {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: current.id } });
    if (!member.passwordHash || !(await argon2.verify(member.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        passwordHash: await argon2.hash(dto.newPassword),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });
    return this.buildSession(updated);
  }

  private async buildSession(member: Member) {
    const payload: SessionPayload = {
      sub: member.id,
      role: member.role,
      mustChangePassword: member.mustChangePassword,
      tokenVersion: member.tokenVersion,
    };
    return {
      token: await this.jwt.signAsync(payload),
      member: {
        id: member.id,
        name: member.name,
        matricula: member.matricula,
        email: member.email,
        githubUsername: member.githubUsername,
        role: member.role,
        mustChangePassword: member.mustChangePassword,
      },
    };
  }

  private async ensureDefaultAccounts() {
    for (const { password, ...account } of DEFAULT_ACCOUNTS) {
      const existing = await this.prisma.member.findUnique({ where: { matricula: account.matricula } });
      if (existing) continue;

      await this.prisma.member.create({
        data: {
          ...account,
          allUnits: true,
          mustChangePassword: false,
          passwordHash: await argon2.hash(password),
        },
      });
    }
  }
}
