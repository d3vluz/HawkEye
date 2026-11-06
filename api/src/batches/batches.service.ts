import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateBatchDto, CaptureDto } from './dto/create-batch.dto';
import { SessionMember } from '../auth/decorators';
import { InspectionSettingsService } from '../settings/inspection-settings.service';

@Injectable()
export class BatchesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private inspection: InspectionSettingsService,
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

  async create(dto: CreateBatchDto, author: SessionMember) {
    if (!author.matricula) throw new BadRequestException('Conta sem matrícula não pode registrar coletas');
    await this.assertUnitAccess(author.id, dto.unit_id);
    const settings = await this.inspection.get();
    const verdicts = new Map(dto.captures.map((c) => [c.sha256, this.inspection.evaluate(settings, {
      gridRows: c.grid_rows,
      gridCols: c.grid_cols,
      areasDetected: c.areas_detected,
      hasMissingPins: c.has_missing_pins,
      hasExtraPins: c.has_extra_pins,
      hasDamagedPins: c.has_damaged_pins,
      hasWrongColorPins: c.has_wrong_color_pins,
      hasShaftDefects: c.has_shaft_defects,
      structureOverride: c.structure_override,
    })]));

    const timestamp = this.extractTimestamp(dto);
    const pathsMap = new Map<string, Record<string, string>>();

    for (const capture of dto.captures) {
      pathsMap.set(capture.sha256, await this.moveCaptureToPermanent(capture, timestamp));
    }

    const total = dto.captures.length;
    const valid = dto.captures.filter((c) => verdicts.get(c.sha256)!.isValid).length;

    const batch = await this.prisma.batch.create({
      data: {
        name: dto.name,
        description: dto.description,
        totalCaptures: total,
        validCaptures: valid,
        invalidCaptures: total - valid,
        authorMatricula: author.matricula,
        unitId: dto.unit_id,
      },
    });

    for (const capture of dto.captures) {
      const paths = pathsMap.get(capture.sha256) ?? {};
      const verdict = verdicts.get(capture.sha256)!;
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
          isValid: verdict.isValid,
          areasDetected: capture.areas_detected,
          pinsDetected: capture.pins_detected,
          defectsCount: capture.defects_count + (verdict.hasStructureDamage ? 1 : 0),
          hasMissingPins: capture.has_missing_pins,
          hasExtraPins: capture.has_extra_pins,
          hasDamagedPins: capture.has_damaged_pins,
          hasWrongColorPins: capture.has_wrong_color_pins,
          hasStructureDamage: verdict.hasStructureDamage,
          hasShaftDefects: capture.has_shaft_defects,
          corrections: capture.corrections?.length ? (capture.corrections as unknown as Prisma.InputJsonValue) : undefined,
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

  private async assertUnitAccess(memberId: string, unitId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { allUnits: true, units: { where: { id: unitId }, select: { id: true } } },
    });
    const unitExists = (await this.prisma.unit.count({ where: { id: unitId } })) > 0;
    if (!unitExists) throw new BadRequestException('Linha não encontrada');
    if (!member?.allUnits && !member?.units.length) throw new ForbiddenException('Você não tem acesso a esta linha');
  }

  findAll(unitId?: string) {
    return this.list({ unitId });
  }

  findMine(matricula: string | null) {
    return matricula ? this.list({ authorMatricula: matricula }) : { batches: [] };
  }

  private async list(where: { authorMatricula?: string; unitId?: string }) {
    const batches = await this.prisma.batch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { unit: { select: { id: true, name: true } } },
    });
    const defectSums = await this.prisma.capture.groupBy({
      by: ['batchId'],
      where: { batch: where },
      _sum: { defectsCount: true },
    });
    const names = await this.authorNames(batches.map((b) => b.authorMatricula));
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
        author: this.authorOf(b.authorMatricula, names),
        unit: b.unit,
      })),
    };
  }

  findOne(id: string) {
    return this.detail({ id });
  }

  findOneOwned(id: string, matricula: string | null) {
    if (!matricula) throw new NotFoundException('Lote não encontrado');
    return this.detail({ id, authorMatricula: matricula });
  }

  private async authorNames(matriculas: Array<string | null>) {
    const unique = [...new Set(matriculas.filter((m): m is string => m !== null))];
    const members = await this.prisma.member.findMany({
      where: { matricula: { in: unique } },
      select: { matricula: true, name: true },
    });
    return new Map(members.map((m) => [m.matricula, m.name]));
  }

  private authorOf(matricula: string | null, names: Map<string | null, string>) {
    return matricula ? { matricula, name: names.get(matricula) ?? null } : null;
  }

  private async detail(where: { id: string; authorMatricula?: string }) {
    const batch = await this.prisma.batch.findFirst({
      where,
      include: { captures: { include: { compartments: true } }, unit: { select: { id: true, name: true } } },
    });
    if (!batch) throw new NotFoundException('Lote não encontrado');

    const names = await this.authorNames([batch.authorMatricula]);

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        description: batch.description,
        created_at: batch.createdAt.toISOString(),
        author: this.authorOf(batch.authorMatricula, names),
        unit: batch.unit,
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
        corrections: c.corrections,
      })),
    };
  }

  async remove(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { captures: true } });
    if (!batch) throw new NotFoundException('Lote não encontrado');

    const urls = batch.captures.flatMap((c) => [
      c.originalUri,
      c.processedUri,
      c.processedAreasUri,
      c.processedPinsUri,
      c.processedShaftUri,
    ]);

    // Imagens antes do registro: se o storage falhar, o lote continua visível
    // e a exclusão pode ser repetida, sem deixar arquivos órfãos.
    await this.storage.deleteByUrls(urls, this.storage.permanent);
    await this.prisma.batch.delete({ where: { id } });
    return { success: true };
  }
}
