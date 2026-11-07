// Corpo enviado pela revisão ao registrar um lote; as chaves seguem o formato devolvido pelo worker.

import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export const DEFEITOS = ['missing', 'extra', 'wrongColor', 'damaged', 'shaft', 'structure'] as const;

export class Correcao {
  @IsIn(DEFEITOS) defect: (typeof DEFEITOS)[number];
  @IsBoolean() detected: boolean;
  @IsBoolean() corrected: boolean;
}

export class CapturaRevisada {
  @IsString() filename: string;
  @IsString() sha256: string;
  @IsNumber() areas_detected: number;
  @IsOptional() @IsNumber() grid_rows?: number;
  @IsOptional() @IsNumber() grid_cols?: number;
  @IsNumber() defects_count: number;
  @IsBoolean() has_missing_pins: boolean;
  @IsBoolean() has_extra_pins: boolean;
  @IsBoolean() has_damaged_pins: boolean;
  @IsBoolean() has_wrong_color_pins: boolean;
  @IsBoolean() has_shaft_defects: boolean;
  @IsOptional() @IsBoolean() structure_override?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => Correcao) corrections?: Correcao[];
}

export class NovoLote {
  @IsString() name: string;
  @IsString() unit_id: string;
  @IsOptional() @IsString() description?: string;
  @IsString() batch_timestamp: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CapturaRevisada) captures: CapturaRevisada[];
}
