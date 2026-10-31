import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateBatchDto, CaptureDto } from './dto/create-batch.dto';

@Injectable()
export class BatchesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private extractTimestamp(dto: CreateBatchDto): string {
    if (dto.batch_timestamp) return dto.batch_timestamp;
    const uri = dto.captures[0].original_uri;
    return uri.split(`/${this.storage.review}/`)[1]?.split('/')[0] ?? '';
  }

  private async moveCaptureToPermanent(capture: CaptureDto, timestamp: string) {
    const { sha256, filename } = capture;
    const files = [
      [`${timestamp}/${sha256}/original_${filename}`, 'original'],
      [`${timestamp}/${sha256}/processed_areas.png`, 'areas'],
      [`${timestamp}/${sha256}/processed_pins.png`, 'pins'],
      [`${timestamp}/${sha256}/processed_boxes.png`, 'boxes'],
      [`${timestamp}/${sha256}/processed_shafts.png`, 'shafts'],
    ] as const;

    const paths: Record<string, string> = {};
    for (const [path, key] of files) {
      const moved = await this.storage.move(path, path, this.storage.review, this.storage.permanent);
      if (moved) paths[key] = path;
    }
    return paths;
  }

  async create(dto: CreateBatchDto) {
    const timestamp = this.extractTimestamp(dto);
    const pathsMap = new Map<string, Record<string, string>>();

    for (const capture of dto.captures) {
      pathsMap.set(capture.sha256, await this.moveCaptureToPermanent(capture, timestamp));
    }

    const total = dto.captures.length;
    const valid = dto.captures.filter((c) => c.is_valid).length;

    const batch = await this.prisma.batch.create({
      data: {
        name: dto.name,
        description: dto.description,
        totalCaptures: total,
        validCaptures: valid,
        invalidCaptures: total - valid,
      },
    });

    for (const capture of dto.captures) {
      const paths = pathsMap.get(capture.sha256) ?? {};
      const cap = await this.prisma.capture.create({
        data: {
          batchId: batch.id,
          filename: capture.filename,
          sha256: capture.sha256,
          originalUri: this.storage.getPublicUrl(paths['original'] ?? '', this.storage.permanent),
          processedUri: paths['boxes'] ? this.storage.getPublicUrl(paths['boxes'], this.storage.permanent) : undefined,
          processedAreasUri: paths['areas'] ? this.storage.getPublicUrl(paths['areas'], this.storage.permanent) : undefined,
          processedPinsUri: paths['pins'] ? this.storage.getPublicUrl(paths['pins'], this.storage.permanent) : undefined,
          processedShaftUri: paths['shafts'] ? this.storage.getPublicUrl(paths['shafts'], this.storage.permanent) : undefined,
          isValid: capture.is_valid,
          areasDetected: capture.areas_detected,
          pinsDetected: capture.pins_detected,
          defectsCount: capture.defects_count,
          hasMissingPins: capture.has_missing_pins,
          hasExtraPins: capture.has_extra_pins,
          hasDamagedPins: capture.has_damaged_pins,
          hasWrongColorPins: capture.has_wrong_color_pins,
          hasStructureDamage: capture.has_structure_damage,
          hasShaftDefects: capture.has_shaft_defects,
        },
      });

      if (capture.compartments?.length) {
        await this.prisma.compartment.createMany({
          data: capture.compartments.map((c) => ({
            id: randomUUID(),
            captureId: cap.id,
            gridRow: c.grid_row,
            gridCol: c.grid_col,
            bboxX: c.bbox_x,
            bboxY: c.bbox_y,
            bboxWidth: c.bbox_width,
            bboxHeight: c.bbox_height,
            pinsCount: c.pins_count,
            isValid: c.is_valid,
            hasDefect: c.has_defect,
          })),
        });
      }
    }

    return { success: true, message: `Lote '${dto.name}' criado com sucesso`, batch_id: batch.id, total_captures: total, valid_captures: valid, invalid_captures: total - valid };
  }

  async reject(timestamp: string) {
    await this.storage.deleteFolder(timestamp, this.storage.review);
    return { success: true, message: `Lote ${timestamp} rejeitado`, timestamp };
  }

  async findAll() {
    const batches = await this.prisma.batch.findMany({ orderBy: { createdAt: 'desc' } });
    const defectSums = await this.prisma.capture.groupBy({
      by: ['batchId'],
      _sum: { defectsCount: true },
    });
    const defectsByBatch = new Map(defectSums.map((d) => [d.batchId, d._sum.defectsCount ?? 0]));

    return {
      batches: batches.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        total_captures: b.totalCaptures,
        total_defects: defectsByBatch.get(b.id) ?? 0,
        quality_score: b.totalCaptures > 0 ? (b.validCaptures / b.totalCaptures) * 100 : 0,
        created_at: b.createdAt.toISOString(),
      })),
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { captures: { include: { compartments: true } } },
    });
    if (!batch) throw new NotFoundException('Lote não encontrado');

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        created_at: batch.createdAt.toISOString(),
        total_captures: batch.totalCaptures,
        valid_captures: batch.validCaptures,
        invalid_captures: batch.invalidCaptures,
        total_defects: batch.captures.reduce((s, c) => s + c.defectsCount, 0),
        quality_score: batch.totalCaptures > 0 ? (batch.validCaptures / batch.totalCaptures) * 100 : 0,
      },
      captures: batch.captures.map((c) => ({
        id: c.id,
        filename: c.filename,
        is_valid: c.isValid,
        original_uri: c.originalUri,
        processed_uri: c.processedUri,
        processed_areas_uri: c.processedAreasUri,
        processed_pins_uri: c.processedPinsUri,
        processed_shaft_uri: c.processedShaftUri,
        defects_count: c.defectsCount,
        hasMissingPins: c.hasMissingPins,
        hasExtraPins: c.hasExtraPins,
        hasDamagedPins: c.hasDamagedPins,
        hasWrongColorPins: c.hasWrongColorPins,
        hasStructureDamage: c.hasStructureDamage,
        hasShaftDefects: c.hasShaftDefects,
      })),
    };
  }

  async remove(id: string) {
    await this.prisma.batch.delete({ where: { id } });
    return { success: true };
  }
}
