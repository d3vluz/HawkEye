import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateInspectionDto {
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(50) expectedRows: number | null;
  @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(50) expectedCols: number | null;
  @IsInt() @Min(0) @Max(100) minQualityScore: number;
  @IsOptional() @IsBoolean() rejectMissingPins?: boolean;
  @IsOptional() @IsBoolean() rejectExtraPins?: boolean;
  @IsOptional() @IsBoolean() rejectDamagedPins?: boolean;
  @IsOptional() @IsBoolean() rejectWrongColorPins?: boolean;
  @IsOptional() @IsBoolean() rejectStructureDamage?: boolean;
  @IsOptional() @IsBoolean() rejectShaftDefects?: boolean;
}
