// Rotas da inspeção: recebe as fotos do lote no bucket de revisão e pede a análise ao worker.

import { BadRequestException, Body, Controller, Module, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createHash } from 'crypto';
import { ArmazenamentoService } from '../armazenamento/armazenamento.service';
import { Perfis } from '../autenticacao/decoradores';
import { ImagemParaAnalise, WorkerService } from '../worker/worker.service';

const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);
const IMAGENS_POR_LOTE = 10;

@Perfis('EMPLOYEE')
@Controller()
export class ImagensController {
  constructor(
    private armazenamento: ArmazenamentoService,
    private worker: WorkerService,
  ) {}

  @Post('upload-batch')
  @UseInterceptors(FilesInterceptor('files', IMAGENS_POR_LOTE))
  async enviar(@UploadedFiles() arquivos: Express.Multer.File[]) {
    if (!arquivos?.length) throw new BadRequestException('Nenhum arquivo enviado');
    const invalido = arquivos.find((a) => !TIPOS_ACEITOS.has(a.mimetype));
    if (invalido) throw new BadRequestException(`Tipo não suportado: ${invalido.mimetype}`);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const files: ImagemParaAnalise[] = [];
    for (const arquivo of arquivos) {
      const sha256 = createHash('sha256').update(arquivo.buffer).digest('hex');
      const storage_path = `${timestamp}/${sha256}/original_${arquivo.originalname}`;
      await this.armazenamento.enviar(storage_path, arquivo.buffer, arquivo.mimetype, this.armazenamento.revisao);
      files.push({ filename: arquivo.originalname, storage_path, sha256, timestamp });
    }
    return { success: true, batch_timestamp: timestamp, total_uploaded: files.length, files };
  }

  @Post('process-images')
  analisar(@Body() corpo: { images?: ImagemParaAnalise[] }) {
    if (!corpo.images?.length) throw new BadRequestException('Nenhuma imagem para processar');
    return this.worker.analisar(corpo.images);
  }
}

@Module({ controllers: [ImagensController] })
export class ImagensModule {}
