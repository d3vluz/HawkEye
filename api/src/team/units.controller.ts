import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitNameDto } from './dto/unit-name.dto';
import { CurrentMember, Roles, SessionMember } from '../auth/decorators';

@Roles('ADMIN')
@Controller('api/units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  findAll() {
    return this.units.findAll();
  }

  // Declarada antes de ':id' para "mine" não ser interpretado como um id.
  @Roles('EMPLOYEE')
  @Get('mine')
  findMine(@CurrentMember() member: SessionMember) {
    return this.units.findForMember(member.id);
  }

  @Post()
  create(@Body() dto: UnitNameDto) {
    return this.units.create(dto.name);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: UnitNameDto) {
    return this.units.rename(id, dto.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.units.remove(id);
  }
}
