// Decoradores de rota: rota pública, perfis permitidos, rota liberada antes da troca de senha e membro da sessão.

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const ROTA_PUBLICA = 'rotaPublica';
export const PERFIS = 'perfis';
export const LIBERADA_SEM_TROCA_DE_SENHA = 'liberadaSemTrocaDeSenha';

export interface MembroDaSessao {
  id: string;
  name: string;
  matricula: string;
  email: string | null;
  githubUsername: string | null;
  role: MemberRole;
  mustChangePassword: boolean;
}

export const Publica = () => SetMetadata(ROTA_PUBLICA, true);
export const Perfis = (...perfis: MemberRole[]) => SetMetadata(PERFIS, perfis);
export const LiberadaSemTrocaDeSenha = () => SetMetadata(LIBERADA_SEM_TROCA_DE_SENHA, true);

export const MembroAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): MembroDaSessao => ctx.switchToHttp().getRequest().membro,
);
