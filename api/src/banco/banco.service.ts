// Cliente do Prisma compartilhado por toda a API; conecta na subida e desconecta ao encerrar.

import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class BancoService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [BancoService], exports: [BancoService] })
export class BancoModule {}
