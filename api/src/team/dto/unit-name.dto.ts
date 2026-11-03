import { IsString, Matches, MaxLength } from 'class-validator';

export class UnitNameDto {
  @IsString() @Matches(/\S/) @MaxLength(40) name: string;
}
