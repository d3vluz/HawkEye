import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.metrics.getDashboard();
  }
}
