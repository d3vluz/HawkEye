// Cadastro de membros: criar, editar, redefinir senha e desativar, sem expor hash nem versão do token.

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { BancoService } from '../banco/banco.service';
import { AlteracaoDeMembro, NovoMembro } from './dto';

const MENSAGEM_DE_DUPLICADO = 'Matrícula ou e-mail já cadastrado';

const COM_LINHAS = { units: { select: { unit: { select: { id: true, name: true } } } } } satisfies Prisma.MemberInclude;

function semDadosSensiveis({ passwordHash, tokenVersion, status, units, ...membro }: Prisma.MemberGetPayload<{ include: typeof COM_LINHAS }>) {
  return {
    ...membro,
    hasPassword: passwordHash !== null,
    units: units.map((v) => v.unit).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const vinculos = (linhaIds: string[]) => linhaIds.map((unitId) => ({ unitId }));

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
    const membros = await this.banco.member.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, include: COM_LINHAS });
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
        units: todasAsLinhas ? undefined : { create: vinculos(dados.unitIds ?? []) },
      },
      include: COM_LINHAS,
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
        units: dados.unitIds ? { deleteMany: {}, create: vinculos(dados.unitIds) } : undefined,
      },
      include: COM_LINHAS,
    }));
    return semDadosSensiveis(membro);
  }

  async redefinirSenha(id: string, senhaTemporaria: string, quemAlteraId: string) {
    if (id === quemAlteraId) throw new BadRequestException('Use a troca de senha da sua própria conta');
    await this.buscar(id);
    const membro = await this.banco.member.update({
      where: { id },
      data: { passwordHash: await argon2.hash(senhaTemporaria), mustChangePassword: true, tokenVersion: { increment: 1 } },
      include: COM_LINHAS,
    });
    return semDadosSensiveis(membro);
  }

  async remover(id: string, quemRemoveId: string) {
    if (id === quemRemoveId) throw new BadRequestException('Você não pode remover a própria conta');
    await this.buscar(id);
    // Exclusão lógica: os lotes continuam apontando para o membro, que perde o acesso e as sessões abertas.
    await this.banco.member.update({
      where: { id },
      data: { status: 'INACTIVE', passwordHash: null, tokenVersion: { increment: 1 }, units: { deleteMany: {} } },
    });
    return { success: true };
  }

  private async buscar(id: string) {
    const membro = await this.banco.member.findUnique({ where: { id } });
    if (!membro || membro.status !== 'ACTIVE') throw new NotFoundException('Membro não encontrado');
    return membro;
  }
}
