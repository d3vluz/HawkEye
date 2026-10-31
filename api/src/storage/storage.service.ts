import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

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
