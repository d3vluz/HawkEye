// Rotas da equipe: membros, linhas de produção e os números da página de Membros.

import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { BancoService } from '../banco/banco.service';
import { MembroAtual, MembroDaSessao, Perfis } from '../autenticacao/decoradores';
import { AlteracaoDeMembro, NomeDaLinha, NovoMembro, SenhaTemporaria } from './dto';
import { LinhasService } from './linhas.service';
import { MembrosService } from './membros.service';

@Perfis('ADMIN')
@Controller('api/members')
export class MembrosController {
  constructor(private readonly membros: MembrosService) {}

  @Get()
  listar() {
    return this.membros.listar();
  }

  @Post()
  criar(@Body() dados: NovoMembro) {
    return this.membros.criar(dados);
  }

  @Patch(':id')
  alterar(@Param('id') id: string, @Body() dados: AlteracaoDeMembro, @MembroAtual() quem: MembroDaSessao) {
    return this.membros.alterar(id, dados, quem.id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  redefinirSenha(@Param('id') id: string, @Body() dados: SenhaTemporaria, @MembroAtual() quem: MembroDaSessao) {
    return this.membros.redefinirSenha(id, dados.temporaryPassword, quem.id);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @MembroAtual() quem: MembroDaSessao) {
    return this.membros.remover(id, quem.id);
  }
}

@Perfis('ADMIN')
@Controller('api/units')
export class LinhasController {
  constructor(private readonly linhas: LinhasService) {}

  @Get()
  listar() {
    return this.linhas.listar();
  }

  @Perfis('EMPLOYEE')
  @Get('mine')
  minhas(@MembroAtual() membro: MembroDaSessao) {
    return this.linhas.doMembro(membro.id);
  }

  @Post()
  criar(@Body() dados: NomeDaLinha) {
    return this.linhas.criar(dados.name);
  }

  @Patch(':id')
  renomear(@Param('id') id: string, @Body() dados: NomeDaLinha) {
    return this.linhas.renomear(id, dados.name);
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.linhas.remover(id);
  }
}

@Perfis('ADMIN')
@Controller('api/team')
export class EquipeController {
  constructor(private banco: BancoService) {}

  @Get('overview')
  async resumo() {
    const inicioDeHoje = new Date();
    inicioDeHoje.setHours(0, 0, 0, 0);
    const [members, activeToday, units] = await Promise.all([
      this.banco.member.count(),
      this.banco.member.count({ where: { lastAccessAt: { gte: inicioDeHoje } } }),
      this.banco.unit.count(),
    ]);
    return { members, activeToday, units };
  }
}

@Module({
  controllers: [MembrosController, LinhasController, EquipeController],
  providers: [MembrosService, LinhasService],
})
export class EquipeModule {}
