'use server';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { gradesDoMes } from '@/lib/reg061-dados';

export async function supervisoresParaExportar() {
  await requireRole('coordenador');

  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));
}

export type Previa = {
  supervisorNome: string;
  contratos: number;
  marcacoes: Record<string, number>;
};

/** O que sairá no arquivo, antes de gerar — evita baixar um mês vazio à toa. */
export async function previaDoMes(
  competencia: string,
  supervisorId: string | null,
): Promise<Previa[]> {
  await requireRole('coordenador');

  const grades = await gradesDoMes(competencia, supervisorId);

  return grades.map((g) => {
    const marcacoes: Record<string, number> = {};
    for (const linha of g.linhas) {
      for (const m of linha.marcacoes) {
        if (m === '' || m === 'S' || m === 'D') continue;
        marcacoes[m] = (marcacoes[m] ?? 0) + 1;
      }
    }
    return { supervisorNome: g.supervisorNome, contratos: g.linhas.length, marcacoes };
  });
}
