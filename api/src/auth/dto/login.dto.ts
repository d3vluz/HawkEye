import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString() @MinLength(1) @MaxLength(254) identifier: string;
  @IsString() @MaxLength(128) password: string;
}
