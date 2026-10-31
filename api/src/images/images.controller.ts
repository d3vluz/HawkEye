import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';

@Controller()
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('upload-batch')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadBatch(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado');
    return this.images.uploadBatch(files);
  }

  @Post('process-images')
  async processImages(@Body() body: { images: Array<{ filename: string; storage_path: string; sha256: string; timestamp: string }> }) {
    if (!body.images?.length) throw new BadRequestException('Nenhuma imagem para processar');
    return this.images.processImages(body.images);
  }
}
