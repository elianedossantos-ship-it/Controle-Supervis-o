import { SignJWT, jwtVerify } from 'jose';
import { ehPapel, type Papel } from './papeis';

export const COOKIE_SESSAO = 'sessao';

export type Sessao = {
  usuarioId: string;
  nome: string;
  email: string;
  papel: Papel;
};

function segredo(): Uint8Array {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error('SESSION_SECRET não definida ou com menos de 32 caracteres.');
  }
  return new TextEncoder().encode(valor);
}

/**
 * Sessão longa de propósito: o supervisor registra visita em campo e não deve
 * relogar a cada visita (seção 5). O prazo vem do ambiente, padrão 30 dias.
 */
export function duracaoEmDias(): number {
  const dias = Number(process.env.SESSION_DIAS ?? 30);
  return Number.isFinite(dias) && dias > 0 ? dias : 30;
}

export function duracaoEmSegundos(): number {
  return duracaoEmDias() * 24 * 60 * 60;
}

/** Assina o token da sessão. O papel viaja no token (seção 11). */
export async function assinarSessao(sessao: Sessao): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);

  return new SignJWT({
    nome: sessao.nome,
    email: sessao.email,
    papel: sessao.papel,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sessao.usuarioId)
    .setIssuedAt(agora)
    .setExpirationTime(agora + duracaoEmSegundos())
    .sign(segredo());
}

/** Verifica o token. Retorna null para token ausente, inválido ou expirado. */
export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ['HS256'] });

    if (!payload.sub || !ehPapel(payload.papel)) return null;

    return {
      usuarioId: payload.sub,
      nome: String(payload.nome ?? ''),
      email: String(payload.email ?? ''),
      papel: payload.papel,
    };
  } catch {
    return null;
  }
}
