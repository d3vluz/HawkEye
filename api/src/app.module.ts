// Módulo raiz: junta os módulos de cada área e expõe o healthcheck usado pelo Docker.

import { Controller, Get, Module } from '@nestjs/common';
import { ArmazenamentoModule } from './armazenamento/armazenamento.service';
import { AutenticacaoModule } from './autenticacao/autenticacao.controller';
import { Publica } from './autenticacao/decoradores';
import { BancoModule } from './banco/banco.service';
import { ConfiguracoesModule } from './configuracoes/configuracoes.controller';
import { EquipeModule } from './equipe/equipe.controller';
import { ImagensModule } from './imagens/imagens.controller';
import { LotesModule } from './lotes/lotes.controller';
import { MetricasModule } from './metricas/metricas.controller';
import { WorkerModule } from './worker/worker.service';

@Publica()
@Controller('health')
export class SaudeController {
  @Get()
  saude() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    BancoModule,
    ArmazenamentoModule,
    WorkerModule,
    AutenticacaoModule,
    EquipeModule,
    ImagensModule,
    LotesModule,
    ConfiguracoesModule,
    MetricasModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
