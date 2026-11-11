// Corpos aceitos pelas rotas de autenticação.

import { IsString, MaxLength, MinLength } from 'class-validator';

export class DadosDeLogin {
  @IsString() @MinLength(1) @MaxLength(254) identifier: string;
  @IsString() @MaxLength(128) password: string;
}

export class DadosDeTrocaDeSenha {
  @IsString() @MaxLength(128) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}
