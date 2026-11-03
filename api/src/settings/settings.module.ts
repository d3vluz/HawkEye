import { Module } from '@nestjs/common';
import { CvWorkerModule } from '../cv-worker/cv-worker.module';
import { SettingsController } from './settings.controller';
import { InspectionSettingsService } from './inspection-settings.service';
import { SystemService } from './system.service';

@Module({
  imports: [CvWorkerModule],
  controllers: [SettingsController],
  providers: [InspectionSettingsService, SystemService],
  exports: [InspectionSettingsService],
})
export class SettingsModule {}
