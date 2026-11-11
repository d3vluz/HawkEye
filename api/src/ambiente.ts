// Variáveis de ambiente lidas uma vez na subida; o docker-compose injeta todas a partir do .env da raiz.

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida`);
  return valor;
}

export const ambiente = {
  segredoJwt: obrigatoria('JWT_SECRET'),
  origemDoFrontend: obrigatoria('FRONTEND_ORIGIN'),
  cookieSeguro: process.env.COOKIE_SECURE === 'true',
  urlDoWorker: process.env.CV_WORKER_URL ?? 'http://worker:8000',
  minio: {
    endereco: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
    usuario: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    senha: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    bucketRevisao: process.env.MINIO_BUCKET_REVIEW ?? 'review',
    bucketPermanente: process.env.MINIO_BUCKET_PERMANENT ?? 'permanent',
    enderecoPublico: process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000',
  },
};
