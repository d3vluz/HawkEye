import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentMember, Roles, SessionMember } from '../auth/decorators';
import { InspectionSettingsService } from './inspection-settings.service';
import { SystemService } from './system.service';
import { UpdateInspectionDto } from './dto/update-inspection.dto';

@Roles('ADMIN')
@Controller('api/settings')
export class SettingsController {
  constructor(
    private inspection: InspectionSettingsService,
    private system: SystemService,
  ) {}

  // O funcionário também lê: a revisão mostra o veredito com os mesmos critérios.
  @Roles('ADMIN', 'EMPLOYEE')
  @Get('inspection')
  getInspection() {
    return this.inspection.get();
  }

  @Put('inspection')
  updateInspection(@Body() dto: UpdateInspectionDto, @CurrentMember() member: SessionMember) {
    return this.inspection.update(dto, member.matricula);
  }

  @Get('storage')
  storage() {
    return this.system.storageUsage();
  }

  @Post('storage/cleanup')
  cleanup() {
    return this.system.cleanupAbandoned();
  }

  @Get('status')
  status() {
    return this.system.status();
  }
}
