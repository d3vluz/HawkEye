import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TemporaryPasswordDto } from './dto/temporary-password.dto';
import { CurrentMember, Roles, SessionMember } from '../auth/decorators';

@Roles('ADMIN')
@Controller('api/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  findAll() {
    return this.members.findAll();
  }

  @Post()
  create(@Body() dto: CreateMemberDto) {
    return this.members.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto, @CurrentMember() actor: SessionMember) {
    return this.members.update(id, dto, actor.id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id') id: string, @Body() dto: TemporaryPasswordDto, @CurrentMember() actor: SessionMember) {
    return this.members.resetPassword(id, dto.temporaryPassword, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentMember() actor: SessionMember) {
    return this.members.remove(id, actor.id);
  }
}
