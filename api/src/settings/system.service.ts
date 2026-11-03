import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CvWorkerService } from '../cv-worker/cv-worker.service';

// Bem acima das 8h da sessão: uma revisão mais antiga que isso não tem mais quem a aprove.
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

type StoredObject = { Key?: string; Size?: number; LastModified?: Date };
type Check = { status: 'online' | 'offline'; latencyMs: number; error?: string };

async function measure(probe: () => Promise<unknown>): Promise<Check> {
  const start = Date.now();
  try {
    await probe();
    return { status: 'online', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'offline', latencyMs: Date.now() - start, error: (error as Error).message };
  }
}

@Injectable()
export class SystemService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private worker: CvWorkerService,
  ) {}

  async status() {
    const [database, storage, worker] = await Promise.all([
      measure(() => this.prisma.$queryRaw`SELECT 1`),
      measure(() => Promise.all([this.storage.ping(this.storage.review), this.storage.ping(this.storage.permanent)])),
      measure(() => this.worker.ping()),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      api: { status: 'online' as const, uptimeSeconds: Math.round(process.uptime()) },
      database,
      storage,
      worker,
    };
  }

  async storageUsage() {
    const [review, permanent] = await Promise.all([
      this.storage.listAll(this.storage.review),
      this.storage.listAll(this.storage.permanent),
    ]);
    const abandoned = this.abandonedReviews(review);
    return {
      review: this.summarize(review),
      permanent: this.summarize(permanent),
      abandoned: { sessions: abandoned.sessions, objects: abandoned.keys.length, bytes: abandoned.bytes },
      abandonedAfterHours: ABANDONED_AFTER_MS / 3_600_000,
    };
  }

  async cleanupAbandoned() {
    const abandoned = this.abandonedReviews(await this.storage.listAll(this.storage.review));
    await this.storage.deleteKeys(abandoned.keys, this.storage.review);
    return { sessions: abandoned.sessions, objects: abandoned.keys.length, bytes: abandoned.bytes };
  }

  private summarize(objects: StoredObject[]) {
    return { objects: objects.length, bytes: objects.reduce((sum, o) => sum + (o.Size ?? 0), 0) };
  }

  // Cada inspeção grava tudo sob a pasta do seu timestamp; a pasta só conta como
  // abandonada quando nenhum arquivo dela foi tocado dentro do prazo.
  private abandonedReviews(objects: StoredObject[]) {
    const folders = new Map<string, { keys: string[]; bytes: number; lastModified: number }>();
    for (const { Key, Size, LastModified } of objects) {
      if (!Key) continue;
      const prefix = Key.split('/')[0];
      const folder = folders.get(prefix) ?? { keys: [], bytes: 0, lastModified: 0 };
      folder.keys.push(Key);
      folder.bytes += Size ?? 0;
      folder.lastModified = Math.max(folder.lastModified, LastModified?.getTime() ?? 0);
      folders.set(prefix, folder);
    }

    const cutoff = Date.now() - ABANDONED_AFTER_MS;
    const stale = [...folders.values()].filter((f) => f.lastModified < cutoff);
    return {
      sessions: stale.length,
      keys: stale.flatMap((f) => f.keys),
      bytes: stale.reduce((sum, f) => sum + f.bytes, 0),
    };
  }
}
