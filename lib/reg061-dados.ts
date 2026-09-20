import 'server-only';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { carteira, contratos, feriados, usuarios, visitas } from '@/db/schema';
import type { FeriadoRegistro } from './feriados-aplicaveis';
import { montarGrade, primeiroDia, ultimoDia, type GradeREG061 } from './reg061';

/**
 * Monta a grade do REG-061 de um ou de todos os supervisores, a partir das
 * visitas do mês.
 */
export async function gradesDoMes(
  competencia: string,
  supervisorId: string | null,
): Promise<GradeREG061[]> {
  const inicio = primeiroDia(competencia);
  const fim = ultimoDia(competencia);

  /*
   * Sem filtro de `ativo`: o REG-061 é registro histórico do mês. Um supervisor
   * inativado depois precisa continuar aparecendo no mês em que trabalhou.
   */
  const condicoesSupervisor = [eq(usuarios.papel, 'supervisor')];
  if (supervisorId) condicoesSupervisor.push(eq(usuarios.id, supervisorId));

  const supervisores = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(...condicoesSupervisor))
    .orderBy(asc(usuarios.nome));

  const feriadosDoMes: FeriadoRegistro[] = await db
    .select({
      data: feriados.data,
      descricao: feriados.descricao,
      abrangencia: feriados.abrangencia,
      uf: feriados.uf,
      municipio: feriados.municipio,
    })
    .from(feriados)
    .where(and(gte(feriados.data, inicio), lte(feriados.data, fim)));

  const grades: GradeREG061[] = [];

  for (const s of supervisores) {
    /*
     * "Uma linha por contrato da carteira vigente do supervisor no mês": o
     * vínculo conta se esteve aberto em qualquer dia do mês, e não só se está
     * aberto hoje — um contrato que mudou de carteira em outubro precisa
     * aparecer no REG-061 de setembro.
     */
    const daCarteira = await db
      .select({
        contratoId: contratos.id,
        nome: contratos.nome,
        endereco: contratos.endereco,
        periodicidade: contratos.periodicidade,
        cidade: contratos.cidade,
        uf: contratos.uf,
      })
      .from(carteira)
      .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
      .where(
        and(
          eq(carteira.supervisorId, s.id),
          lte(carteira.inicio, fim),
          or(isNull(carteira.fim), gte(carteira.fim, inicio)),
        ),
      )
      .orderBy(asc(contratos.nome));

    // Um contrato pode ter tido dois vínculos com o mesmo supervisor no mês.
    const unicos = new Map(daCarteira.map((c) => [c.contratoId, c]));

    const doMes = await db
      .select({
        contratoId: visitas.contratoId,
        dia: sql<number>`extract(day from ${visitas.dataPrevista})::int`,
        origem: visitas.origem,
        status: visitas.status,
      })
      .from(visitas)
      .where(
        and(
          eq(visitas.supervisorId, s.id),
          gte(visitas.dataPrevista, inicio),
          lte(visitas.dataPrevista, fim),
        ),
      );

    /*
     * Numa exportação de todos, supervisor sem contrato no mês não vira aba
     * vazia. Quando a aba é pedida pelo nome, ela sai mesmo vazia — senão o
     * download devolveria nada e a coordenação ficaria sem saber por quê.
     */
    if (unicos.size === 0 && doMes.length === 0 && !supervisorId) continue;

    grades.push(
      montarGrade(competencia, s.nome, [...unicos.values()], doMes, feriadosDoMes),
    );
  }

  return grades;
}
