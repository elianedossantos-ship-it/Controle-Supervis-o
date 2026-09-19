'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, asc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { requireRole, sessaoAtual } from '@/lib/auth';
import { PAPEIS } from '@/lib/papeis';
import { hashSenha } from '@/lib/senha';
import {
  errosPorCampo,
  marcado,
  texto,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/formulario';

const base = {
  nome: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  telefone: z.string().trim().nullable(),
  whatsapp: z.string().trim().nullable(),
  papel: z.enum(PAPEIS, { message: 'Escolha um papel.' }),
  ativo: z.boolean(),
};

const esquemaNovo = z.object({
  ...base,
  senha: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.'),
});

const esquemaEdicao = z.object(base);

function lerCampos(formData: FormData) {
  return {
    nome: texto(formData.get('nome')),
    email: texto(formData.get('email')).toLowerCase(),
    telefone: textoOuNulo(formData.get('telefone')),
    whatsapp: textoOuNulo(formData.get('whatsapp')),
    papel: texto(formData.get('papel')),
    ativo: marcado(formData.get('ativo')),
  };
}

/** Devolve ao formulário o que foi digitado, menos a senha. */
function devolver(formData: FormData): Record<string, string> {
  return {
    nome: texto(formData.get('nome')),
    email: texto(formData.get('email')),
    telefone: texto(formData.get('telefone')),
    whatsapp: texto(formData.get('whatsapp')),
    papel: texto(formData.get('papel')),
    ativo: marcado(formData.get('ativo')) ? 'on' : '',
  };
}

export async function criarUsuario(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('coordenador');

  const campos = devolver(formData);
  const dados = esquemaNovo.safeParse({
    ...lerCampos(formData),
    senha: String(formData.get('senha') ?? ''),
  });

  if (!dados.success) {
    return { erros: errosPorCampo(dados.error), campos };
  }

  const [jaExiste] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, dados.data.email));

  if (jaExiste) {
    return { erros: { email: 'Já existe usuário com este e-mail.' }, campos };
  }

  const { senha, ...resto } = dados.data;
  await db.insert(usuarios).values({ ...resto, senhaHash: await hashSenha(senha) });

  revalidatePath('/cadastros/supervisores');
  redirect('/cadastros/supervisores?criado=1');
}

export async function atualizarUsuario(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('coordenador');
  const id = texto(formData.get('id'));

  const campos = devolver(formData);
  const dados = esquemaEdicao.safeParse(lerCampos(formData));

  if (!dados.success) {
    return { erros: errosPorCampo(dados.error), campos };
  }

  const [atual] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!atual) return { erro: 'Usuário não encontrado.', campos };

  // Papel e situação são gestão de usuários: só o admin mexe (seção 2).
  const ehAdmin = sessao.papel === 'admin';
  const mudouPapel = dados.data.papel !== atual.papel;
  const mudouAtivo = dados.data.ativo !== atual.ativo;

  if (!ehAdmin && (mudouPapel || mudouAtivo)) {
    return {
      erro: 'Alterar papel ou inativar usuário é do admin. Os demais campos foram mantidos.',
      campos,
    };
  }

  // Um admin que se inativa ou se rebaixa perde o acesso na hora, e se for o
  // último admin ninguém mais entra para desfazer.
  if (sessao.usuarioId === id && (mudouPapel || mudouAtivo)) {
    return { erro: 'Você não pode alterar o próprio papel nem a própria situação.', campos };
  }

  if (atual.papel === 'admin' && (mudouPapel || mudouAtivo)) {
    const [outroAdmin] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.papel, 'admin'), eq(usuarios.ativo, true), ne(usuarios.id, id)));

    if (!outroAdmin) {
      return { erro: 'Este é o único admin ativo. Promova outro antes de alterá-lo.', campos };
    }
  }

  const [conflito] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.email, dados.data.email), ne(usuarios.id, id)));

  if (conflito) {
    return { erros: { email: 'Já existe usuário com este e-mail.' }, campos };
  }

  await db.update(usuarios).set(dados.data).where(eq(usuarios.id, id));

  revalidatePath('/cadastros/supervisores');
  redirect('/cadastros/supervisores?salvo=1');
}

const esquemaSenha = z
  .object({
    id: z.string().uuid(),
    senha: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: 'As senhas não conferem.',
    path: ['confirmacao'],
  });

/** Reset de senha é do admin (seção 2). */
export async function redefinirSenha(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('admin');

  const dados = esquemaSenha.safeParse({
    id: texto(formData.get('id')),
    senha: String(formData.get('senha') ?? ''),
    confirmacao: String(formData.get('confirmacao') ?? ''),
  });

  if (!dados.success) return { erros: errosPorCampo(dados.error) };

  await db
    .update(usuarios)
    .set({ senhaHash: await hashSenha(dados.data.senha) })
    .where(eq(usuarios.id, dados.data.id));

  return { ok: true };
}

export async function listarUsuarios() {
  await requireRole('coordenador');

  return db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      telefone: usuarios.telefone,
      whatsapp: usuarios.whatsapp,
      papel: usuarios.papel,
      ativo: usuarios.ativo,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.nome));
}

export async function buscarUsuario(id: string) {
  await requireRole('coordenador');
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  return usuario ?? null;
}

export async function ehAdminLogado() {
  const sessao = await sessaoAtual();
  return sessao?.papel === 'admin';
}
