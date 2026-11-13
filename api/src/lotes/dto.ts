// Corpo enviado pela revisão ao registrar um lote; as chaves seguem o formato devolvido pelo worker.

import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

// Quantas ocorrências de cada defeito o sistema detectou, antes da revisão do operador.
export class ContagensDetectadas {
  @IsInt() @Min(0) missing: number;
  @IsInt() @Min(0) extra: number;
  @IsInt() @Min(0) wrongColor: number;
  @IsInt() @Min(0) damaged: number;
  @IsInt() @Min(0) shaft: number;
}

export class CapturaRevisada {
  @IsString() filename: string;
  @IsString() sha256: string;
  @IsNumber() areas_detected: number;
  @IsOptional() @IsNumber() grid_rows?: number;
  @IsOptional() @IsNumber() grid_cols?: number;
  @ValidateNested() @Type(() => ContagensDetectadas) detected_counts: ContagensDetectadas;
  @IsBoolean() has_missing_pins: boolean;
  @IsBoolean() has_extra_pins: boolean;
  @IsBoolean() has_damaged_pins: boolean;
  @IsBoolean() has_wrong_color_pins: boolean;
  @IsBoolean() has_shaft_defects: boolean;
  @IsOptional() @IsBoolean() structure_override?: boolean;
}

export class NovoLote {
  @IsString() name: string;
  @IsUUID() unit_id: string;
  @IsOptional() @IsString() description?: string;
  @IsString() batch_timestamp: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CapturaRevisada) captures: CapturaRevisada[];
}
