// Rotas da tela de configurações do admin: critérios, armazenamento e status dos serviços.

import { Body, Controller, Get, Module, Post, Put } from '@nestjs/common';
import { MembroAtual, MembroDaSessao, Perfis } from '../autenticacao/decoradores';
import { CriteriosService } from './criterios.service';
import { NovosCriterios } from './dto';
import { SistemaService } from './sistema.service';

@Perfis('ADMIN')
@Controller('api/settings')
export class ConfiguracoesController {
  constructor(
    private criterios: CriteriosService,
    private sistema: SistemaService,
  ) {}

  @Perfis('ADMIN', 'EMPLOYEE')
  @Get('inspection')
  lerCriterios() {
    return this.criterios.ler();
  }

  @Put('inspection')
  salvarCriterios(@Body() dados: NovosCriterios, @MembroAtual() membro: MembroDaSessao) {
    return this.criterios.salvar(dados, membro.id);
  }

  @Get('storage')
  armazenamento() {
    return this.sistema.usoDoArmazenamento();
  }

  @Post('storage/cleanup')
  limpar() {
    return this.sistema.limparAbandonadas();
  }

  @Get('status')
  status() {
    return this.sistema.status();
  }
}

@Module({
  controllers: [ConfiguracoesController],
  providers: [CriteriosService, SistemaService],
  exports: [CriteriosService],
})
export class ConfiguracoesModule {}
