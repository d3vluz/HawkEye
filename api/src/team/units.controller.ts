import { Controller, Get } from '@nestjs/common';
import { UnitsService } from './units.service';

@Controller('api/units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  findAll() {
    return this.units.findAll();
  }
}
