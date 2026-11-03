import { IsString, MaxLength, MinLength } from 'class-validator';

export class TemporaryPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) temporaryPassword: string;
}
