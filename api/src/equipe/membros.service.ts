// Cadastro de membros: criar, editar, redefinir senha e remover, sem expor hash nem versão do token.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Member, Prisma, Unit } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { BancoService } from '../banco/banco.service';
import { AlteracaoDeMembro, NovoMembro } from './dto';

const MENSAGEM_DE_DUPLICADO = 'Matrícula ou e-mail já cadastrado';

function semDadosSensiveis({ passwordHash, tokenVersion, ...membro }: Member & { units: Unit[] }) {
  return { ...membro, hasPassword: passwordHash !== null };
}

async function semDuplicado<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      throw new ConflictException(MENSAGEM_DE_DUPLICADO);
    }
    throw erro;
  }
}

@Injectable()
export class MembrosService {
  constructor(private banco: BancoService) {}

  async listar() {
    const membros = await this.banco.member.findMany({ orderBy: { createdAt: 'asc' }, include: { units: true } });
    return membros.map(semDadosSensiveis);
  }

  async criar(dados: NovoMembro) {
    const todasAsLinhas = dados.allUnits ?? false;
    const passwordHash = await argon2.hash(dados.temporaryPassword);
    const membro = await semDuplicado(() => this.banco.member.create({
      data: {
        name: dados.name,
        matricula: dados.matricula.trim().toLowerCase(),
        email: dados.email?.trim().toLowerCase(),
        phone: dados.phone,
        allUnits: todasAsLinhas,
        passwordHash,
        units: todasAsLinhas ? undefined : { connect: (dados.unitIds ?? []).map((id) => ({ id })) },
      },
      include: { units: true },
    }));
    return semDadosSensiveis(membro);
  }

  async alterar(id: string, dados: AlteracaoDeMembro, quemAlteraId: string) {
    const atual = await this.buscar(id);
    const mudaAcesso =
      (dados.role !== undefined && dados.role !== atual.role) ||
      (dados.status !== undefined && dados.status !== atual.status);

    if (mudaAcesso && id === quemAlteraId) {
      throw new BadRequestException('Você não pode alterar o próprio perfil ou status');
    }

    const membro = await semDuplicado(() => this.banco.member.update({
      where: { id },
      data: {
        name: dados.name,
        email: dados.email?.trim().toLowerCase() ?? dados.email,
        phone: dados.phone,
        role: dados.role,
        status: dados.status,
        allUnits: dados.allUnits,
        tokenVersion: mudaAcesso ? { increment: 1 } : undefined,
        units: dados.unitIds ? { set: dados.unitIds.map((linhaId) => ({ id: linhaId })) } : undefined,
      },
      include: { units: true },
    }));
    return semDadosSensiveis(membro);
  }

  async redefinirSenha(id: string, senhaTemporaria: string, quemAlteraId: string) {
    if (id === quemAlteraId) throw new BadRequestException('Use a troca de senha da sua própria conta');
    await this.buscar(id);
    const membro = await this.banco.member.update({
      where: { id },
      data: { passwordHash: await argon2.hash(senhaTemporaria), mustChangePassword: true, tokenVersion: { increment: 1 } },
      include: { units: true },
    });
    return semDadosSensiveis(membro);
  }

  async remover(id: string, quemRemoveId: string) {
    if (id === quemRemoveId) throw new BadRequestException('Você não pode remover a própria conta');
    await this.buscar(id);
    await this.banco.member.delete({ where: { id } });
    return { success: true };
  }

  private async buscar(id: string) {
    const membro = await this.banco.member.findUnique({ where: { id } });
    if (!membro) throw new NotFoundException('Membro não encontrado');
    return membro;
  }
}
