import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller('api/invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  findAll() {
    return this.invites.findAll();
  }

  @Post()
  create(@Body() dto: CreateInviteDto) {
    return this.invites.create(dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.invites.cancel(id);
  }

  @Post(':id/resend')
  resend(@Param('id') id: string) {
    return this.invites.resend(id);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string) {
    return this.invites.accept(id);
  }
}
