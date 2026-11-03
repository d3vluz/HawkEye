import { BadRequestException, Injectable } from '@nestjs/common';
import { InspectionSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInspectionDto } from './dto/update-inspection.dto';

const SETTINGS_ID = 1;

export interface DetectedDefects {
  gridRows?: number;
  gridCols?: number;
  areasDetected: number;
  hasMissingPins: boolean;
  hasExtraPins: boolean;
  hasDamagedPins: boolean;
  hasWrongColorPins: boolean;
  hasShaftDefects: boolean;
}

@Injectable()
export class InspectionSettingsService {
  constructor(private prisma: PrismaService) {}

  get() {
    return this.prisma.inspectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  update(dto: UpdateInspectionDto, actorMatricula: string | null) {
    if ((dto.expectedRows === null) !== (dto.expectedCols === null)) {
      throw new BadRequestException('Informe linhas e colunas juntas, ou deixe as duas em branco');
    }
    const data = { ...dto, updatedByMatricula: actorMatricula };
    return this.prisma.inspectionSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
  }

  // O veredito sai daqui e não do navegador: o cliente só informa o que o worker detectou.
  evaluate(settings: InspectionSettings, detected: DetectedDefects) {
    const hasStructureDamage = this.hasStructureDamage(settings, detected);
    const rejected =
      (settings.rejectMissingPins && detected.hasMissingPins) ||
      (settings.rejectExtraPins && detected.hasExtraPins) ||
      (settings.rejectDamagedPins && detected.hasDamagedPins) ||
      (settings.rejectWrongColorPins && detected.hasWrongColorPins) ||
      (settings.rejectShaftDefects && detected.hasShaftDefects) ||
      (settings.rejectStructureDamage && hasStructureDamage);
    return { isValid: !rejected, hasStructureDamage };
  }

  private hasStructureDamage(settings: InspectionSettings, detected: DetectedDefects) {
    const { expectedRows, expectedCols } = settings;
    if (expectedRows === null || expectedCols === null) return false;
    if (detected.gridRows === undefined || detected.gridCols === undefined) {
      return detected.areasDetected !== expectedRows * expectedCols;
    }
    return detected.gridRows !== expectedRows || detected.gridCols !== expectedCols;
  }
}
