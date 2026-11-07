// Status dos serviços, uso do armazenamento e limpeza de revisões abandonadas no bucket de revisão.

import { Injectable } from '@nestjs/common';
import { _Object } from '@aws-sdk/client-s3';
import { ArmazenamentoService } from '../armazenamento/armazenamento.service';
import { BancoService } from '../banco/banco.service';
import { WorkerService } from '../worker/worker.service';

const ABANDONADA_APOS_MS = 24 * 60 * 60 * 1000;

async function medir(verificacao: () => Promise<unknown>) {
  const inicio = Date.now();
  try {
    await verificacao();
    return { status: 'online' as const, latencyMs: Date.now() - inicio };
  } catch (erro) {
    return { status: 'offline' as const, latencyMs: Date.now() - inicio, error: (erro as Error).message };
  }
}

function totais(objetos: _Object[]) {
  return { objects: objetos.length, bytes: objetos.reduce((soma, o) => soma + (o.Size ?? 0), 0) };
}

function revisoesAbandonadas(objetos: _Object[]) {
  const pastas = new Map<string, { chaves: string[]; bytes: number; ultimaAlteracao: number }>();
  for (const { Key, Size, LastModified } of objetos) {
    if (!Key) continue;
    const nome = Key.split('/')[0];
    const pasta = pastas.get(nome) ?? { chaves: [], bytes: 0, ultimaAlteracao: 0 };
    pasta.chaves.push(Key);
    pasta.bytes += Size ?? 0;
    pasta.ultimaAlteracao = Math.max(pasta.ultimaAlteracao, LastModified?.getTime() ?? 0);
    pastas.set(nome, pasta);
  }
  const limite = Date.now() - ABANDONADA_APOS_MS;
  const antigas = [...pastas.values()].filter((p) => p.ultimaAlteracao < limite);
  return { sessions: antigas.length, chaves: antigas.flatMap((p) => p.chaves), bytes: antigas.reduce((soma, p) => soma + p.bytes, 0) };
}

@Injectable()
export class SistemaService {
  constructor(
    private banco: BancoService,
    private armazenamento: ArmazenamentoService,
    private worker: WorkerService,
  ) {}

  async status() {
    const [database, storage, worker] = await Promise.all([
      medir(() => this.banco.$queryRaw`SELECT 1`),
      medir(() => Promise.all([this.armazenamento.verificar(this.armazenamento.revisao), this.armazenamento.verificar(this.armazenamento.permanente)])),
      medir(() => this.worker.verificar()),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      api: { status: 'online' as const, uptimeSeconds: Math.round(process.uptime()) },
      database,
      storage,
      worker,
    };
  }

  async usoDoArmazenamento() {
    const [revisao, permanente] = await Promise.all([
      this.armazenamento.listar(this.armazenamento.revisao),
      this.armazenamento.listar(this.armazenamento.permanente),
    ]);
    const abandonadas = revisoesAbandonadas(revisao);
    return {
      review: totais(revisao),
      permanent: totais(permanente),
      abandoned: { sessions: abandonadas.sessions, objects: abandonadas.chaves.length, bytes: abandonadas.bytes },
      abandonedAfterHours: ABANDONADA_APOS_MS / 3_600_000,
    };
  }

  async limparAbandonadas() {
    const abandonadas = revisoesAbandonadas(await this.armazenamento.listar(this.armazenamento.revisao));
    await this.armazenamento.apagarChaves(abandonadas.chaves, this.armazenamento.revisao);
    return { sessions: abandonadas.sessions, objects: abandonadas.chaves.length, bytes: abandonadas.bytes };
  }
}
