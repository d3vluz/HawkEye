import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { TeamController } from './team.controller';
import { TeamSeedService } from './team-seed.service';

@Module({
  controllers: [MembersController, UnitsController, TeamController],
  providers: [MembersService, UnitsService, TeamSeedService],
})
export class TeamModule {}
