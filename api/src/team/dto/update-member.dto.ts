import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @Matches(/^[0-9()+\s-]{8,20}$/) phone?: string | null;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @IsIn(['ADMIN', 'EMPLOYEE']) role?: 'ADMIN' | 'EMPLOYEE';
}
