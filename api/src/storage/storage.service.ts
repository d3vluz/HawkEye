import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
  _Object,
} from '@aws-sdk/client-s3';

const MAX_KEYS_PER_DELETE = 1000;

@Injectable()
export class StorageService {
  private client: S3Client;
  private reviewBucket: string;
  private permanentBucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.client = new S3Client({
      endpoint: config.get<string>('MINIO_ENDPOINT', 'http://minio:9000'),
      credentials: {
        accessKeyId: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      },
      region: 'us-east-1',
      forcePathStyle: true,
    });
    this.reviewBucket = config.get<string>('MINIO_BUCKET_REVIEW', 'review');
    this.permanentBucket = config.get<string>('MINIO_BUCKET_PERMANENT', 'permanent');
    this.publicUrl = config.get<string>('MINIO_PUBLIC_URL', 'http://localhost:9000');
  }

  getPublicUrl(key: string, bucket?: string): string {
    const b = bucket ?? this.permanentBucket;
    return `${this.publicUrl}/${b}/${key}`;
  }

  get review() { return this.reviewBucket; }
  get permanent() { return this.permanentBucket; }

  async upload(key: string, body: Buffer, contentType: string, bucket?: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: bucket ?? this.reviewBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    }));
  }

  async move(srcKey: string, destKey: string, srcBucket: string, destBucket: string): Promise<boolean> {
    try {
      await this.client.send(new CopyObjectCommand({
        Bucket: destBucket,
        CopySource: `${srcBucket}/${srcKey}`,
        Key: destKey,
      }));
      await this.client.send(new DeleteObjectCommand({ Bucket: srcBucket, Key: srcKey }));
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUrls(urls: Array<string | null>, bucket: string): Promise<void> {
    await this.deleteKeys(urls.flatMap((url) => url?.split(`/${bucket}/`)[1] || []), bucket);
  }

  async deleteKeys(keys: string[], bucket: string): Promise<void> {
    for (let start = 0; start < keys.length; start += MAX_KEYS_PER_DELETE) {
      const { Errors } = await this.client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(start, start + MAX_KEYS_PER_DELETE).map((Key) => ({ Key })) },
      }));
      if (Errors?.length) throw new Error(`Falha ao apagar ${Errors.length} imagens do storage`);
    }
  }

  async listAll(bucket: string): Promise<_Object[]> {
    const objects: _Object[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
      objects.push(...(page.Contents ?? []));
      token = page.NextContinuationToken;
    } while (token);
    return objects;
  }

  async ping(bucket: string): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
  }

  async deleteFolder(prefix: string, bucket?: string): Promise<void> {
    const b = bucket ?? this.reviewBucket;
    const list = await this.client.send(new ListObjectsV2Command({ Bucket: b, Prefix: prefix }));

    if (!list.Contents?.length) return;

    await this.client.send(new DeleteObjectsCommand({
      Bucket: b,
      Delete: { Objects: list.Contents.map(({ Key }) => ({ Key: Key! })) },
    }));
  }
}
