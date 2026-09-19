'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carteira, contratos, usuarios } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { hojeISO } from '@/lib/datas';
import { texto, type EstadoForm } from '@/lib/formulario';

const esquema = z.object({
  contratoId: z.string().uuid('Contrato inválido.'),
  // string vazia = tirar o contrato de qualquer carteira
  supervisorId: z.union([z.string().uuid('Supervisor inválido.'), z.literal('')]),
});

/**
 * Move um contrato de carteira. Fecha o vínculo vigente com fim = hoje e abre o
 * novo, preservando o histórico — nunca apaga nem reescreve o vínculo anterior.
 *
 * Tudo numa transação: fechar o antigo sem abrir o novo deixaria o contrato sem
 * supervisor, e abrir sem fechar bateria no índice carteira_vigente_unica.
 */
export async function moverContrato(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('coordenador');

  const dados = esquema.safeParse({
    contratoId: texto(formData.get('contratoId')),
    supervisorId: texto(formData.get('supervisorId')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const { contratoId, supervisorId } = dados.data;
  const hoje = hojeISO();

  const [vigente] = await db
    .select()
    .from(carteira)
    .where(and(eq(carteira.contratoId, contratoId), isNull(carteira.fim)));

  if (vigente?.supervisorId === supervisorId) {
    return { ok: true };
  }

  if (supervisorId !== '') {
    const [supervisor] = await db
      .select({ ativo: usuarios.ativo })
      .from(usuarios)
      .where(eq(usuarios.id, supervisorId));

    if (!supervisor) return { erro: 'Supervisor não encontrado.' };
    if (!supervisor.ativo) return { erro: 'Não dá para passar contrato a usuário inativo.' };
  }

  await db.transaction(async (tx) => {
    if (vigente) {
      // Vínculo aberto hoje e movido hoje viraria uma linha de duração zero,
      // com inicio depois do fim. Nesse caso o registro é substituído.
      if (vigente.inicio >= hoje) {
        await tx.delete(carteira).where(eq(carteira.id, vigente.id));
      } else {
        await tx.update(carteira).set({ fim: hoje }).where(eq(carteira.id, vigente.id));
      }
    }

    if (supervisorId !== '') {
      await tx.insert(carteira).values({ contratoId, supervisorId, inicio: hoje });
    }
  });

  revalidatePath('/cadastros/carteira');
  return { ok: true };
}

/** Supervisores ativos, com a contagem de contratos vigentes de cada um. */
export async function listarCarteiras() {
  await requireRole('coordenador');

  const supervisores = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));

  const vinculos = await db
    .select({
      contratoId: contratos.id,
      contratoNome: contratos.nome,
      endereco: contratos.endereco,
      periodicidade: contratos.periodicidade,
      contratoAtivo: contratos.ativo,
      supervisorId: carteira.supervisorId,
      inicio: carteira.inicio,
    })
    .from(contratos)
    .leftJoin(carteira, and(eq(carteira.contratoId, contratos.id), isNull(carteira.fim)))
    .orderBy(asc(contratos.nome));

  return { supervisores, vinculos };
}

/** Histórico completo de um contrato: quem teve, e de quando até quando. */
export async function historicoDoContrato(contratoId: string) {
  await requireRole('coordenador');

  return db
    .select({
      id: carteira.id,
      inicio: carteira.inicio,
      fim: carteira.fim,
      supervisorNome: usuarios.nome,
    })
    .from(carteira)
    .innerJoin(usuarios, eq(usuarios.id, carteira.supervisorId))
    .where(eq(carteira.contratoId, contratoId))
    .orderBy(asc(carteira.inicio));
}
