import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Driver de disco, para desenvolvimento. Fica em módulo separado e só é
 * carregado quando STORAGE_DRIVER=local, para o acesso dinâmico a arquivo não
 * entrar no pacote de produção, que usa S3.
 */
function raiz(): string {
  return resolve(process.env.STORAGE_LOCAL_DIR ?? './armazenamento');
}

function caminho(chave: string): string {
  const base = raiz();
  const destino = resolve(join(base, chave));
  // Cinto e suspensório: mesmo com a chave já validada, confere que não escapou.
  if (destino !== base && !destino.startsWith(base + sep)) {
    throw new Error('Chave de evidência fora do diretório de armazenamento.');
  }
  return destino;
}

export async function gravarLocal(chave: string, bytes: Uint8Array): Promise<void> {
  const destino = caminho(chave);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, bytes);
}

export async function lerLocal(chave: string): Promise<Uint8Array | null> {
  try {
    return await readFile(caminho(chave));
  } catch {
    return null;
  }
}
