import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { CvWorkerModule } from '../cv-worker/cv-worker.module';

@Module({
  imports: [CvWorkerModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
