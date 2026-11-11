// Cliente HTTP do worker de visão computacional (rede interna do Docker).

import { Global, Injectable, Module, ServiceUnavailableException } from '@nestjs/common';
import { ambiente } from '../ambiente';

export interface ImagemParaAnalise {
  filename: string;
  storage_path: string;
  sha256: string;
  timestamp: string;
}

@Injectable()
export class WorkerService {
  async analisar(images: ImagemParaAnalise[]): Promise<unknown> {
    const resposta = await fetch(`${ambiente.urlDoWorker}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });
    if (!resposta.ok) throw new ServiceUnavailableException(`O worker respondeu ${resposta.status}`);
    return resposta.json();
  }

  async verificar(): Promise<void> {
    const resposta = await fetch(`${ambiente.urlDoWorker}/health`, { signal: AbortSignal.timeout(3000) });
    if (!resposta.ok) throw new Error(`O worker respondeu ${resposta.status}`);
  }
}

@Global()
@Module({ providers: [WorkerService], exports: [WorkerService] })
export class WorkerModule {}
