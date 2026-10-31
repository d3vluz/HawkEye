import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { CvWorkerService, CvImageInput } from '../cv-worker/cv-worker.service';

const VALID_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

@Injectable()
export class ImagesService {
  constructor(
    private storage: StorageService,
    private cvWorker: CvWorkerService,
  ) {}

  async uploadBatch(files: Express.Multer.File[]) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const uploaded: CvImageInput[] = [];

    for (const file of files) {
      if (!VALID_TYPES.has(file.mimetype)) {
        throw new BadRequestException(`Tipo não suportado: ${file.mimetype}`);
      }
      const sha256 = createHash('sha256').update(file.buffer).digest('hex');
      const storagePath = `${timestamp}/${sha256}/original_${file.originalname}`;

      await this.storage.upload(storagePath, file.buffer, file.mimetype, this.storage.review);

      uploaded.push({ filename: file.originalname, storage_path: storagePath, sha256, timestamp });
    }

    return {
      success: true,
      batch_timestamp: timestamp,
      total_uploaded: uploaded.length,
      files: uploaded,
    };
  }

  async processImages(images: CvImageInput[]) {
    return this.cvWorker.process(images);
  }
}
