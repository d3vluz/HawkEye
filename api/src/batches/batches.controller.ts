import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';

@Controller('api/batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Post('create')
  create(@Body() dto: CreateBatchDto) {
    return this.batches.create(dto);
  }

  @Post('reject')
  reject(@Body() body: { timestamp: string }) {
    return this.batches.reject(body.timestamp);
  }

  @Get()
  findAll() {
    return this.batches.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batches.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.batches.remove(id);
  }
}
