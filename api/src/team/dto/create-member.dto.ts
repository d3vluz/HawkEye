import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { toPhoneDigits } from './phone';

export class CreateMemberDto {
  @IsString() name: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]+$/) @MaxLength(32) matricula: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Transform(({ value }) => toPhoneDigits(value)) @Matches(/^\d{10,11}$/, { message: 'Telefone precisa ter DDD e 10 ou 11 dígitos' }) phone?: string | null;
  @IsString() @MinLength(8) @MaxLength(128) temporaryPassword: string;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
}
