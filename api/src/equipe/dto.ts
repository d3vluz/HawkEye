// Corpos aceitos pelas rotas de membros e linhas de produção.

import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function apenasDigitos(valor: unknown) {
  if (typeof valor !== 'string') return valor;
  const digitos = valor.replace(/\D/g, '');
  return digitos === '' ? null : digitos;
}

const Telefone = () => (alvo: object, campo: string) => {
  Transform(({ value }) => apenasDigitos(value))(alvo, campo);
  Matches(/^\d{10,11}$/, { message: 'Telefone precisa ter DDD e 10 ou 11 dígitos' })(alvo, campo);
};

export class NovoMembro {
  @IsString() name: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]+$/) @MaxLength(32) matricula: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Telefone() phone?: string | null;
  @IsString() @MinLength(8) @MaxLength(128) temporaryPassword: string;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
}

export class AlteracaoDeMembro {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @Telefone() phone?: string | null;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) unitIds?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @IsIn(['ADMIN', 'EMPLOYEE']) role?: 'ADMIN' | 'EMPLOYEE';
}

export class SenhaTemporaria {
  @IsString() @MinLength(8) @MaxLength(128) temporaryPassword: string;
}

export class NomeDaLinha {
  @IsString() @Matches(/\S/) @MaxLength(40) name: string;
}
