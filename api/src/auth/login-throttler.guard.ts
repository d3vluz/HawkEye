import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  // Atrás do Docker todo cliente pode compartilhar o mesmo IP; incluir o identificador
  // evita que as tentativas de uma pessoa bloqueiem o login das demais.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `${req.ip}:${String(req.body?.identifier ?? '').trim().toLowerCase()}`;
  }
}
