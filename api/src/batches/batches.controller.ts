import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CurrentMember, Roles, SessionMember } from '../auth/decorators';

@Controller('api/batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Roles('EMPLOYEE')
  @Post('create')
  create(@Body() dto: CreateBatchDto, @CurrentMember() author: SessionMember) {
    return this.batches.create(dto, author);
  }

  @Roles('EMPLOYEE')
  @Post('reject')
  reject(@Body() body: { timestamp: string }) {
    return this.batches.reject(body.timestamp);
  }

  // Declaradas antes de ':id' para "mine" não ser interpretado como um id.
  @Roles('EMPLOYEE')
  @Get('mine')
  findMine(@CurrentMember() member: SessionMember) {
    return this.batches.findMine(member.matricula);
  }

  @Roles('EMPLOYEE')
  @Get('mine/:id')
  findOneMine(@Param('id') id: string, @CurrentMember() member: SessionMember) {
    return this.batches.findOneOwned(id, member.matricula);
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query('unitId') unitId?: string) {
    return this.batches.findAll(unitId || undefined);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batches.findOne(id);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.batches.remove(id);
  }
}
