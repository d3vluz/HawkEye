import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsString() name: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]+$/) @MaxLength(32) matricula: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^[0-9()+\s-]{8,20}$/) phone?: string | null;
  @IsString() @MinLength(8) @MaxLength(128) temporaryPassword: string;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
}
