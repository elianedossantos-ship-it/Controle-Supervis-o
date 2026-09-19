import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { papelAtende, type Papel } from './papeis';
import { conferirSenha } from './senha';
import {
  COOKIE_SESSAO,
  assinarSessao,
  duracaoEmSegundos,
  lerSessao,
  type Sessao,
} from './sessao';

/* -------------------------------------------------------------------------- */
/* Leitura da sessão                                                           */
/* -------------------------------------------------------------------------- */

/** Sessão do requisitante, ou null se não houver cookie válido. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const cookieStore = await cookies();
  return lerSessao(cookieStore.get(COOKIE_SESSAO)?.value);
}

/** Exige sessão. Sem ela, manda para o login. */
export async function requireSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  return sessao;
}

/**
 * Exige um papel mínimo. Coordenador atende o que é exigido do supervisor e
 * admin atende o que é exigido do coordenador (seção 2).
 *
 * Isto é autorização de rota. O isolamento por carteira é regra de dados: toda
 * consulta de visita feita por supervisor filtra por supervisor_id no backend.
 */
export async function requireRole(exigido: Papel): Promise<Sessao> {
  const sessao = await requireSessao();
  if (!papelAtende(sessao.papel, exigido)) redirect('/sem-acesso');
  return sessao;
}

/* -------------------------------------------------------------------------- */
/* Login e logout                                                              */
/* -------------------------------------------------------------------------- */

export type ResultadoLogin = { ok: true } | { ok: false; erro: string };

/**
 * Hash real e descartável, de uma senha que ninguém conhece. Serve só para o
 * caminho do e-mail inexistente gastar o mesmo tempo de um bcrypt de verdade.
 */
const HASH_DESCARTE = '$2b$12$Zq4UCDtq6w3gI5t4PZJD/enwFg2UKPRcpH.2y/UVRdXSugq5QLHrO';

export async function autenticar(
  email: string,
  senha: string,
): Promise<ResultadoLogin> {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.trim().toLowerCase()));

  // Mensagem única para e-mail inexistente, senha errada e usuário inativo:
  // dizer qual dos três falhou entrega quais e-mails existem no sistema.
  const generica = { ok: false as const, erro: 'E-mail ou senha inválidos.' };

  if (!usuario) {
    // Gasta o mesmo tempo de um bcrypt real para não vazar, pelo tempo de
    // resposta, quais e-mails estão cadastrados.
    await conferirSenha(senha, HASH_DESCARTE);
    return generica;
  }

  if (!(await conferirSenha(senha, usuario.senhaHash))) return generica;
  if (!usuario.ativo) return generica;

  await abrirSessao({
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel as Papel,
  });

  return { ok: true };
}

export async function abrirSessao(sessao: Sessao): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_SESSAO, await assinarSessao(sessao), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: duracaoEmSegundos(),
  });
}

export async function encerrarSessao(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO);
}
