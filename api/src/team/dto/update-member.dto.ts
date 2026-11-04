import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { toPhoneDigits } from './phone';

export class UpdateMemberDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @Transform(({ value }) => toPhoneDigits(value)) @Matches(/^\d{10,11}$/, { message: 'Telefone precisa ter DDD e 10 ou 11 dígitos' }) phone?: string | null;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @IsIn(['ADMIN', 'EMPLOYEE']) role?: 'ADMIN' | 'EMPLOYEE';
}
