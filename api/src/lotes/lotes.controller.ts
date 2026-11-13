// Rotas de lotes: o funcionário registra, descarta e consulta os próprios; o admin consulta e apaga qualquer um.

import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { MembroAtual, MembroDaSessao, Perfis } from '../autenticacao/decoradores';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.controller';
import { NovoLote } from './dto';
import { LotesService } from './lotes.service';

@Controller('api/batches')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Perfis('EMPLOYEE')
  @Post('create')
  registrar(@Body() dados: NovoLote, @MembroAtual() autor: MembroDaSessao) {
    return this.lotes.registrar(dados, autor);
  }

  @Perfis('EMPLOYEE')
  @Post('reject')
  descartar(@Body() corpo: { timestamp: string }) {
    return this.lotes.descartar(corpo.timestamp);
  }

  // Declaradas antes de ':id' para "mine" não ser interpretado como um id.
  @Perfis('EMPLOYEE')
  @Get('mine')
  meus(@MembroAtual() membro: MembroDaSessao) {
    return this.lotes.listarDoAutor(membro.id);
  }

  @Perfis('EMPLOYEE')
  @Get('mine/:id')
  meu(@Param('id', ParseUUIDPipe) id: string, @MembroAtual() membro: MembroDaSessao) {
    return this.lotes.detalharDoAutor(id, membro.id);
  }

  @Perfis('ADMIN')
  @Get()
  todos(@Query('unitId', new ParseUUIDPipe({ optional: true })) linhaId?: string) {
    return this.lotes.listarTodos(linhaId);
  }

  @Perfis('ADMIN')
  @Get(':id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.detalhar(id);
  }

  @Perfis('ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.lotes.remover(id);
  }
}

@Module({
  imports: [ConfiguracoesModule],
  controllers: [LotesController],
  providers: [LotesService],
})
export class LotesModule {}
