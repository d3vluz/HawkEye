import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export const DEFECT_KEYS = ['missing', 'extra', 'wrongColor', 'damaged', 'shaft', 'structure'] as const;

export class CorrectionDto {
  @IsIn(DEFECT_KEYS) defect: (typeof DEFECT_KEYS)[number];
  @IsBoolean() detected: boolean;
  @IsBoolean() corrected: boolean;
}

export class CompartmentDto {
  @IsNumber() grid_row: number;
  @IsNumber() grid_col: number;
  @IsNumber() bbox_x: number;
  @IsNumber() bbox_y: number;
  @IsNumber() bbox_width: number;
  @IsNumber() bbox_height: number;
  @IsNumber() pins_count: number;
  @IsBoolean() is_valid: boolean;
  @IsBoolean() has_defect: boolean;
}

export class CaptureDto {
  @IsString() filename: string;
  @IsString() sha256: string;
  @IsString() original_uri: string;
  @IsOptional() @IsString() processed_uri?: string;
  @IsOptional() @IsString() processed_areas_uri?: string;
  @IsOptional() @IsString() processed_pins_uri?: string;
  @IsOptional() @IsString() processed_shaft_uri?: string;
  @IsBoolean() is_valid: boolean;
  @IsNumber() areas_detected: number;
  @IsOptional() @IsNumber() grid_rows?: number;
  @IsOptional() @IsNumber() grid_cols?: number;
  @IsNumber() pins_detected: number;
  @IsNumber() defects_count: number;
  @IsBoolean() has_missing_pins: boolean;
  @IsBoolean() has_extra_pins: boolean;
  @IsBoolean() has_damaged_pins: boolean;
  @IsBoolean() has_wrong_color_pins: boolean;
  @IsBoolean() has_structure_damage: boolean;
  @IsBoolean() has_shaft_defects: boolean;
  // Decisão do operador sobre a estrutura; ausente = vale o cálculo pela grade.
  @IsOptional() @IsBoolean() structure_override?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CorrectionDto) corrections?: CorrectionDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompartmentDto) compartments?: CompartmentDto[];
}

export class CreateBatchDto {
  @IsString() name: string;
  @IsString() unit_id: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() batch_timestamp?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CaptureDto) captures: CaptureDto[];
}
