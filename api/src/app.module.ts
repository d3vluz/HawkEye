import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { CvWorkerModule } from './cv-worker/cv-worker.module';
import { ImagesModule } from './images/images.module';
import { BatchesModule } from './batches/batches.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    PrismaModule,
    StorageModule,
    CvWorkerModule,
    ImagesModule,
    BatchesModule,
    MetricsModule,
    HealthModule,
  ],
})
export class AppModule {}
