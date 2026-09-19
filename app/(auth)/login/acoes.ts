'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { autenticar } from '@/lib/auth';

const entrada = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
  de: z.string().optional(),
});

/**
 * O React limpa o formulário a cada submit de server action. Devolvendo o
 * e-mail digitado, o supervisor não precisa redigitá-lo no celular só porque
 * errou a senha.
 */
export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const emailDigitado = String(formData.get('email') ?? '');

  const dados = entrada.safeParse({
    email: formData.get('email'),
    senha: formData.get('senha'),
    de: formData.get('de'),
  });

  if (!dados.success) {
    return {
      erro: dados.error.issues[0]?.message ?? 'Dados inválidos.',
      email: emailDigitado,
    };
  }

  const resultado = await autenticar(dados.data.email, dados.data.senha);
  if (!resultado.ok) return { erro: resultado.erro, email: emailDigitado };

  // Só aceita caminho interno: um "de" externo viraria redirecionamento aberto.
  // O caminho vem do usuário, então não dá para tipá-lo como Route estática.
  const de = dados.data.de;
  const destino = de && de.startsWith('/') && !de.startsWith('//') ? de : '/';

  redirect(destino as Route);
}
