import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_PENDING_PASSWORD_KEY, IS_PUBLIC_KEY } from './decorators';
import { SESSION_COOKIE, SessionPayload } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { member?: unknown }>();
    const payload = await this.readPayload(request);

    // Consulta o banco a cada requisição para que remoção, inativação e troca de
    // perfil ou senha encerrem sessões abertas sem esperar o JWT expirar.
    const member = await this.prisma.member.findUnique({ where: { id: payload.sub } });
    if (!member || member.status !== 'ACTIVE' || member.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets);
    if (member.mustChangePassword && !allowPending) {
      throw new ForbiddenException('Troque sua senha para continuar');
    }

    request.member = {
      id: member.id,
      name: member.name,
      matricula: member.matricula,
      email: member.email,
      githubUsername: member.githubUsername,
      role: member.role,
      mustChangePassword: member.mustChangePassword,
    };
    return true;
  }

  private async readPayload(request: Request): Promise<SessionPayload> {
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Sessão inválida');
    try {
      return await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida');
    }
  }
}
