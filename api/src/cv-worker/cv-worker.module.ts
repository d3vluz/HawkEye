import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CvWorkerService } from './cv-worker.service';

@Module({
  imports: [HttpModule],
  providers: [CvWorkerService],
  exports: [CvWorkerService],
})
export class CvWorkerModule {}
