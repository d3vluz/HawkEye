// Rotas de sessão: entrar, sair, consultar a própria conta e trocar a senha.

import { Body, Controller, Get, HttpCode, Module, Post, Res, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { Response } from 'express';
import { ambiente } from '../ambiente';
import {
  AutenticacaoService,
  COOKIE_DA_SESSAO,
  DURACAO_DA_SESSAO_MS,
  OPCOES_DO_COOKIE,
} from './autenticacao.service';
import { LiberadaSemTrocaDeSenha, MembroAtual, MembroDaSessao, Publica } from './decoradores';
import { DadosDeLogin, DadosDeTrocaDeSenha } from './dto';
import { GuardaDePerfil, GuardaDeSessao, LimiteDeLogin } from './guardas';

function gravarCookie(res: Response, token: string) {
  res.cookie(COOKIE_DA_SESSAO, token, { ...OPCOES_DO_COOKIE, maxAge: DURACAO_DA_SESSAO_MS });
}

@Controller('api/auth')
export class AutenticacaoController {
  constructor(private readonly autenticacao: AutenticacaoService) {}

  @Publica()
  @UseGuards(LimiteDeLogin)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async entrar(@Body() dados: DadosDeLogin, @Res({ passthrough: true }) res: Response) {
    const { token, membro } = await this.autenticacao.entrar(dados);
    gravarCookie(res, token);
    return membro;
  }
  @Publica()
  @Post('logout')
  @HttpCode(200)
  sair(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_DA_SESSAO, OPCOES_DO_COOKIE);
    return { success: true };
  }

  @LiberadaSemTrocaDeSenha()
  @Get('me')
  minhaConta(@MembroAtual() membro: MembroDaSessao) {
    return membro;
  }

  @LiberadaSemTrocaDeSenha()
  @Post('change-password')
  @HttpCode(200)
  async trocarSenha(@MembroAtual() membro: MembroDaSessao, @Body() dados: DadosDeTrocaDeSenha, @Res({ passthrough: true }) res: Response) {
    const sessao = await this.autenticacao.trocarSenha(membro, dados);
    gravarCookie(res, sessao.token);
    return sessao.membro;
  }
}

@Module({
  imports: [
    JwtModule.register({
      secret: ambiente.segredoJwt,
      signOptions: { expiresIn: '8h', algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AutenticacaoController],
  providers: [
    AutenticacaoService,
    { provide: APP_GUARD, useClass: GuardaDeSessao },
    { provide: APP_GUARD, useClass: GuardaDePerfil },
  ],
})
export class AutenticacaoModule {}
