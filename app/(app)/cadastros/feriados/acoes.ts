'use server';

import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { feriados } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { ABRANGENCIAS } from '@/lib/feriados';
import { UFS } from '@/lib/uf';
import { errosPorCampo, texto, textoOuNulo, type EstadoForm } from '@/lib/formulario';

const esquema = z
  .object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
    descricao: z.string().trim().min(1, 'Informe a descrição.'),
    abrangencia: z.enum(ABRANGENCIAS, { message: 'Escolha a abrangência.' }),
    uf: z.enum(UFS, { message: 'UF inválida. Use a sigla do estado, como RJ ou SP.' }).nullable(),
    municipio: z.string().trim().nullable(),
  })
  // Feriado estadual sem UF, ou municipal sem município, não dá para aplicar a
  // contrato nenhum: viraria feriado de lugar nenhum.
  .refine((d) => d.abrangencia !== 'estadual' || d.uf !== null, {
    message: 'Feriado estadual precisa de UF.',
    path: ['uf'],
  })
  .refine((d) => d.abrangencia !== 'municipal' || (d.uf !== null && d.municipio !== null), {
    message: 'Feriado municipal precisa de UF e município.',
    path: ['municipio'],
  });

export async function criarFeriado(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('coordenador');

  const uf = textoOuNulo(formData.get('uf'));
  const campos = {
    data: texto(formData.get('data')),
    descricao: texto(formData.get('descricao')),
    abrangencia: texto(formData.get('abrangencia')),
    uf: texto(formData.get('uf')),
    municipio: texto(formData.get('municipio')),
  };

  const dados = esquema.safeParse({
    data: texto(formData.get('data')),
    descricao: texto(formData.get('descricao')),
    abrangencia: texto(formData.get('abrangencia')),
    uf: uf ? uf.toUpperCase() : null,
    municipio: textoOuNulo(formData.get('municipio')),
  });

  if (!dados.success) return { erros: errosPorCampo(dados.error), campos };

  await db.insert(feriados).values(dados.data);

  revalidatePath('/cadastros/feriados');
  return { ok: true };
}

export async function excluirFeriado(formData: FormData): Promise<void> {
  await requireRole('coordenador');

  const id = texto(formData.get('id'));
  if (id) await db.delete(feriados).where(eq(feriados.id, id));

  revalidatePath('/cadastros/feriados');
}

export async function listarFeriados() {
  await requireRole('coordenador');
  return db.select().from(feriados).orderBy(asc(feriados.data));
}
