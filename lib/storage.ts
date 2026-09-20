import 'server-only';
import { createHash, randomUUID } from 'node:crypto';

/**
 * Armazenamento das evidências de visita.
 *
 * A seção 11 define "S3 compatível". Qual provedor (Cloudflare R2 ou AWS S3)
 * é a decisão 13.3, ainda aberta — mas os dois falam o mesmo protocolo, então
 * a escolha é configuração, não código. O driver `local` existe para rodar em
 * desenvolvimento sem depender de bucket nenhum.
 */
export type Driver = 'local' | 's3';

export function driverAtual(): Driver {
  return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
}

/** Tipos aceitos: a evidência é foto tirada na hora pela câmera do celular. */
const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export const TAMANHO_MAXIMO = 15 * 1024 * 1024;

export function tipoAceito(contentType: string): boolean {
  return TIPOS_ACEITOS.has(contentType.toLowerCase());
}

function extensaoDe(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    default:
      return 'jpg';
  }
}

/**
 * Chave de armazenamento. Particiona por ano/mês para a pasta não virar um
 * diretório único com dezenas de milhares de fotos, e usa UUID para o nome
 * jamais depender de algo que o usuário controle.
 */
export function novaChave(contentType: string, quando = new Date()): string {
  const ano = quando.getUTCFullYear();
  const mes = String(quando.getUTCMonth() + 1).padStart(2, '0');
  return `evidencias/${ano}/${mes}/${randomUUID()}.${extensaoDe(contentType)}`;
}

/**
 * Só aceita a forma que este módulo gera. A chave vem da base e vai virar
 * caminho de arquivo no driver local: qualquer coisa fora desse formato
 * (`..`, barra inicial, caminho absoluto) é recusada antes de tocar no disco.
 */
export function chaveValida(chave: string): boolean {
  return /^evidencias\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/.test(chave);
}

/** URL que vai para evidencias.arquivo_url. Estável, e resolvida na leitura. */
export function urlDaEvidencia(chave: string): string {
  return `/api/evidencias/${chave}`;
}

export function chaveDaUrl(url: string): string | null {
  const prefixo = '/api/evidencias/';
  if (!url.startsWith(prefixo)) return null;
  const chave = url.slice(prefixo.length);
  return chaveValida(chave) ? chave : null;
}

/* -------------------------------------------------------------------------- */
/* Driver S3 compatível (Cloudflare R2, AWS S3)                                */
/* -------------------------------------------------------------------------- */

type ConfigS3 = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function configS3(): ConfigS3 {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'STORAGE_DRIVER=s3 exige S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.',
    );
  }

  return {
    bucket,
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId,
    secretAccessKey,
  };
}

async function clienteS3() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  const cfg = configS3();

  return {
    cliente: new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      // R2 e a maioria dos compatíveis exigem path-style.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    }),
    bucket: cfg.bucket,
  };
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                 */
/* -------------------------------------------------------------------------- */

export async function guardarEvidencia(
  chave: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  if (!chaveValida(chave)) throw new Error('Chave de evidência inválida.');

  if (driverAtual() === 'local') {
    const { gravarLocal } = await import('./storage-local');
    await gravarLocal(chave, bytes);
    return;
  }

  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { cliente, bucket } = await clienteS3();

  await cliente.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      Body: bytes,
      ContentType: contentType,
      // A evidência é registro do SGI: conferir o hash depois é barato agora.
      ChecksumSHA256: createHash('sha256').update(bytes).digest('base64'),
    }),
  );
}

export type EvidenciaLida = {
  bytes: Uint8Array;
  contentType: string;
};

export async function lerEvidencia(chave: string): Promise<EvidenciaLida | null> {
  if (!chaveValida(chave)) return null;

  const contentType = (() => {
    if (chave.endsWith('.png')) return 'image/png';
    if (chave.endsWith('.webp')) return 'image/webp';
    if (chave.endsWith('.heic')) return 'image/heic';
    return 'image/jpeg';
  })();

  if (driverAtual() === 'local') {
    const { lerLocal } = await import('./storage-local');
    const bytes = await lerLocal(chave);
    return bytes ? { bytes, contentType } : null;
  }

  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { cliente, bucket } = await clienteS3();

  try {
    const resposta = await cliente.send(
      new GetObjectCommand({ Bucket: bucket, Key: chave }),
    );
    const bytes = await resposta.Body!.transformToByteArray();
    return { bytes, contentType: resposta.ContentType ?? contentType };
  } catch {
    return null;
  }
}
