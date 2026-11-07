// Guardas globais: toda rota exige sessão válida (salvo @Publica) e o perfil declarado em @Perfis.

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MemberRole } from '@prisma/client';
import { Request } from 'express';
import { BancoService } from '../banco/banco.service';
import { LIBERADA_SEM_TROCA_DE_SENHA, MembroDaSessao, PERFIS, ROTA_PUBLICA } from './decoradores';
import { COOKIE_DA_SESSAO, ConteudoDoToken, membroPublico } from './autenticacao.service';

@Injectable()
export class GuardaDeSessao implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private banco: BancoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, alvos)) return true;

    const requisicao = contexto.switchToHttp().getRequest<Request & { membro?: MembroDaSessao }>();
    const token = await this.lerToken(requisicao);

    // Consulta o banco a cada requisição para que remoção, inativação e troca de
    // perfil ou senha encerrem sessões abertas sem esperar o JWT expirar.
    const membro = await this.banco.member.findUnique({ where: { id: token.sub } });
    if (!membro || membro.status !== 'ACTIVE' || membro.tokenVersion !== token.tokenVersion) {
      throw new UnauthorizedException('Sessão inválida');
    }
    if (membro.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(LIBERADA_SEM_TROCA_DE_SENHA, alvos)) {
      throw new ForbiddenException('Troque sua senha para continuar');
    }

    requisicao.membro = membroPublico(membro);
    return true;
  }

  private async lerToken(requisicao: Request): Promise<ConteudoDoToken> {
    const token = requisicao.cookies?.[COOKIE_DA_SESSAO];
    if (!token) throw new UnauthorizedException('Sessão inválida');
    try {
      return await this.jwt.verifyAsync<ConteudoDoToken>(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida');
    }
  }
}

@Injectable()
export class GuardaDePerfil implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<MemberRole[]>(PERFIS, [contexto.getHandler(), contexto.getClass()]);
    if (!perfis?.length) return true;
    const membro: MembroDaSessao = contexto.switchToHttp().getRequest().membro;
    if (!perfis.includes(membro.role)) throw new ForbiddenException('Acesso não permitido');
    return true;
  }
}

@Injectable()
export class LimiteDeLogin extends ThrottlerGuard {
  protected async getTracker(requisicao: Record<string, any>): Promise<string> {
    return `${requisicao.ip}:${String(requisicao.body?.identifier ?? '').trim().toLowerCase()}`;
  }
}
