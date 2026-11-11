// Acesso ao MinIO: bucket de revisão (temporário) e permanente (imagens dos lotes registrados).

import { Global, Injectable, Module } from '@nestjs/common';
import {
  _Object,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ambiente } from '../ambiente';

const CHAVES_POR_EXCLUSAO = 1000;

@Injectable()
export class ArmazenamentoService {
  readonly revisao = ambiente.minio.bucketRevisao;
  readonly permanente = ambiente.minio.bucketPermanente;
  private readonly cliente = new S3Client({
    endpoint: ambiente.minio.endereco,
    credentials: { accessKeyId: ambiente.minio.usuario, secretAccessKey: ambiente.minio.senha },
    region: 'us-east-1',
    forcePathStyle: true,
  });

  urlPublica(chave: string, bucket: string): string {
    return `${ambiente.minio.enderecoPublico}/${bucket}/${chave}`;
  }

  async enviar(chave: string, conteudo: Buffer, tipo: string, bucket: string): Promise<void> {
    await this.cliente.send(new PutObjectCommand({ Bucket: bucket, Key: chave, Body: conteudo, ContentType: tipo }));
  }

  async moverParaPermanente(chave: string): Promise<boolean> {
    try {
      await this.cliente.send(new CopyObjectCommand({ Bucket: this.permanente, CopySource: `${this.revisao}/${chave}`, Key: chave }));
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.revisao, Key: chave }));
      return true;
    } catch {
      return false;
    }
  }

  async apagarChaves(chaves: string[], bucket: string): Promise<void> {
    for (let inicio = 0; inicio < chaves.length; inicio += CHAVES_POR_EXCLUSAO) {
      const { Errors } = await this.cliente.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chaves.slice(inicio, inicio + CHAVES_POR_EXCLUSAO).map((Key) => ({ Key })) },
      }));
      if (Errors?.length) throw new Error(`Falha ao apagar ${Errors.length} imagens do storage`);
    }
  }

  async apagarPorUrl(urls: Array<string | null>, bucket: string): Promise<void> {
    await this.apagarChaves(urls.flatMap((url) => url?.split(`/${bucket}/`)[1] || []), bucket);
  }

  async apagarPasta(pasta: string, bucket: string): Promise<void> {
    const objetos = await this.listar(bucket, `${pasta}/`);
    await this.apagarChaves(objetos.flatMap((o) => o.Key ?? []), bucket);
  }

  async listar(bucket: string, prefixo?: string): Promise<_Object[]> {
    const objetos: _Object[] = [];
    let continuacao: string | undefined;
    do {
      const pagina = await this.cliente.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefixo, ContinuationToken: continuacao }));
      objetos.push(...(pagina.Contents ?? []));
      continuacao = pagina.NextContinuationToken;
    } while (continuacao);
    return objetos;
  }

  async verificar(bucket: string): Promise<void> {
    await this.cliente.send(new HeadBucketCommand({ Bucket: bucket }));
  }
}

@Global()
@Module({ providers: [ArmazenamentoService], exports: [ArmazenamentoService] })
export class ArmazenamentoModule {}
