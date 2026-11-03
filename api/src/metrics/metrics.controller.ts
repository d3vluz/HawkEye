import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Roles } from '../auth/decorators';

@Roles('ADMIN')
@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('dashboard')
  getDashboard(@Query('unitId') unitId?: string) {
    return this.metrics.getDashboard(unitId || undefined);
  }
}
