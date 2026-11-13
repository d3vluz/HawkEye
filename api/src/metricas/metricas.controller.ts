// Rota do dashboard do admin, com filtro opcional por linha de produção.

import { Controller, Get, Module, ParseUUIDPipe, Query } from '@nestjs/common';
import { Perfis } from '../autenticacao/decoradores';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.controller';
import { MetricasService } from './metricas.service';

@Perfis('ADMIN')
@Controller('api/metrics')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  @Get('dashboard')
  dashboard(@Query('unitId', new ParseUUIDPipe({ optional: true })) linhaId?: string) {
    return this.metricas.dashboard(linhaId || undefined);
  }
}

@Module({
  imports: [ConfiguracoesModule],
  controllers: [MetricasController],
  providers: [MetricasService],
})
export class MetricasModule {}
