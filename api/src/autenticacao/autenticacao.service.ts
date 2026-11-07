// Login, troca de senha, emissão do JWT da sessão e criação das contas padrão na subida.

import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Member, MemberRole } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { CookieOptions } from 'express';
import { ambiente } from '../ambiente';
import { BancoService } from '../banco/banco.service';
import { MembroDaSessao } from './decoradores';
import { DadosDeLogin, DadosDeTrocaDeSenha } from './dto';

export const COOKIE_DA_SESSAO = 'hawkeye_session';
export const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000;
export const OPCOES_DO_COOKIE: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: ambiente.cookieSeguro, path: '/' };

// Credenciais fixas por decisão do projeto: acesso imediato após subir a stack.
const CONTAS_PADRAO = [
  { matricula: 'admin', password: 'admin', name: 'Evandro Luz', role: MemberRole.ADMIN, githubUsername: 'd3vluz' },
  { matricula: 'user', password: 'user', name: 'Funcionário', role: MemberRole.EMPLOYEE },
];

export interface ConteudoDoToken {
  sub: string;
  role: MemberRole;
  mustChangePassword: boolean;
  tokenVersion: number;
}

export function membroPublico(membro: Member): MembroDaSessao {
  const { id, name, matricula, email, githubUsername, role, mustChangePassword } = membro;
  return { id, name, matricula, email, githubUsername, role, mustChangePassword };
}

@Injectable()
export class AutenticacaoService implements OnModuleInit {
  private hashFalso = '';

  constructor(
    private banco: BancoService,
    private jwt: JwtService,
  ) {}

  async onModuleInit() {
    this.hashFalso = await argon2.hash(randomBytes(32).toString('hex'));
    await this.criarContasPadrao();
  }

  async entrar(dados: DadosDeLogin) {
    const identificador = dados.identifier.trim().toLowerCase();
    const membro = await this.banco.member.findFirst({
      where: { OR: [{ matricula: identificador }, { email: identificador }] },
    });

    const senhaConfere = await argon2.verify(membro?.passwordHash ?? this.hashFalso, dados.password);
    if (!membro?.passwordHash || !senhaConfere || membro.status !== 'ACTIVE') {
      throw new UnauthorizedException('Matrícula, e-mail ou senha incorretos');
    }

    const atualizado = await this.banco.member.update({ where: { id: membro.id }, data: { lastAccessAt: new Date() } });
    return this.criarSessao(atualizado);
  }

  async trocarSenha(atual: MembroDaSessao, dados: DadosDeTrocaDeSenha) {
    const membro = await this.banco.member.findUniqueOrThrow({ where: { id: atual.id } });
    if (!membro.passwordHash || !(await argon2.verify(membro.passwordHash, dados.currentPassword))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    if (dados.currentPassword === dados.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const atualizado = await this.banco.member.update({
      where: { id: membro.id },
      data: { passwordHash: await argon2.hash(dados.newPassword), mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    return this.criarSessao(atualizado);
  }

  private async criarSessao(membro: Member) {
    const conteudo: ConteudoDoToken = {
      sub: membro.id,
      role: membro.role,
      mustChangePassword: membro.mustChangePassword,
      tokenVersion: membro.tokenVersion,
    };
    return { token: await this.jwt.signAsync(conteudo), membro: membroPublico(membro) };
  }

  private async criarContasPadrao() {
    for (const { password, ...conta } of CONTAS_PADRAO) {
      if (await this.banco.member.findUnique({ where: { matricula: conta.matricula } })) continue;
      await this.banco.member.create({
        data: { ...conta, allUnits: true, mustChangePassword: false, passwordHash: await argon2.hash(password) },
      });
    }
  }
}
