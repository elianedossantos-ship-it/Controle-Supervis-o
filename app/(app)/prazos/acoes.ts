'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  carteira,
  contratos,
  feriados,
  obrigacaoOcorrencias,
  obrigacoes,
  programacoes,
  usuarios,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { hojeISO } from '@/lib/datas';
import { texto, textoOuNulo, type EstadoForm } from '@/lib/formulario';
import {
  competenciasDoMes,
  diasUteisDoMes,
  prazoDaCompetencia,
  statusDoCronograma,
  type Obrigacao,
  type StatusOcorrencia,
} from '@/lib/prazos';
import { diasNoMes, primeiroDia, ultimoDia } from '@/lib/reg061';
import { somarDias } from '@/lib/semana';

export type CelulaPrazo = {
  ocorrenciaId: string;
  competencia: string;
  prazo: string;
  status: StatusOcorrencia;
  dataEntrega: string | null;
  diasAtendidos: number | null;
  diasUteis: number | null;
  observacao: string | null;
  marcadoPorNome: string | null;
  marcadoEm: Date | null;
  automatica: boolean;
};

export type LinhaPrazo = {
  obrigacao: Obrigacao;
  /** Uma entrada por supervisor; cada uma com as competências do mês. */
  porSupervisor: Record<string, CelulaPrazo[]>;
};

export type DadosPrazos = {
  mes: string;
  hoje: string;
  supervisores: { id: string; nome: string }[];
  linhas: LinhaPrazo[];
  diasUteis: number;
};

function paraObrigacao(o: typeof obrigacoes.$inferSelect): Obrigacao {
  return {
    id: o.id,
    nome: o.nome,
    recorrencia: o.recorrencia as Obrigacao['recorrencia'],
    diaLimite: o.diaLimite,
    diaSemana: o.diaSemana,
    escopo: o.escopo as Obrigacao['escopo'],
    automatica: o.automatica,
  };
}

/**
 * Gera as ocorrências do mês que ainda não existem.
 *
 * O escopo fala em "rotina no início de cada competência". Aqui a geração é
 * feita ao abrir o mês na tela, e é idempotente: não depende de um cron que
 * pode falhar, e um mês antigo aberto pela primeira vez se monta sozinho.
 */
export async function gerarOcorrenciasDoMes(mes: string): Promise<number> {
  const ativas = await db
    .select()
    .from(obrigacoes)
    .where(eq(obrigacoes.ativo, true))
    .orderBy(asc(obrigacoes.ordem));

  const supervisores = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)));

  if (ativas.length === 0 || supervisores.length === 0) return 0;

  const existentes = await db
    .select({
      obrigacaoId: obrigacaoOcorrencias.obrigacaoId,
      supervisorId: obrigacaoOcorrencias.supervisorId,
      contratoId: obrigacaoOcorrencias.contratoId,
      competencia: obrigacaoOcorrencias.competencia,
    })
    .from(obrigacaoOcorrencias)
    .where(
      and(
        gte(obrigacaoOcorrencias.competencia, primeiroDia(mes)),
        lte(obrigacaoOcorrencias.competencia, ultimoDia(mes)),
      ),
    );

  const chave = (o: string, s: string, c: string | null, comp: string) =>
    `${o}|${s}|${c ?? ''}|${comp}`;
  const jaTem = new Set(
    existentes.map((e) => chave(e.obrigacaoId, e.supervisorId, e.contratoId, e.competencia)),
  );

  const novas: (typeof obrigacaoOcorrencias.$inferInsert)[] = [];

  for (const bruta of ativas) {
    const o = paraObrigacao(bruta);

    for (const competencia of competenciasDoMes(o, mes)) {
      const prazo = prazoDaCompetencia(o, competencia);

      for (const s of supervisores) {
        // Escopo 'contrato' rende uma ocorrência por unidade da carteira.
        const alvos: (string | null)[] =
          o.escopo === 'contrato' ? await contratosVigentes(s.id) : [null];

        for (const contratoId of alvos) {
          if (jaTem.has(chave(o.id, s.id, contratoId, competencia))) continue;

          novas.push({
            obrigacaoId: o.id,
            supervisorId: s.id,
            contratoId,
            competencia,
            prazo,
            status: 'pendente',
          });
          jaTem.add(chave(o.id, s.id, contratoId, competencia));
        }
      }
    }
  }

  if (novas.length === 0) return 0;

  // onConflictDoNothing: dois acessos simultâneos ao mesmo mês não brigam.
  await db.insert(obrigacaoOcorrencias).values(novas).onConflictDoNothing();
  return novas.length;
}

async function contratosVigentes(supervisorId: string): Promise<string[]> {
  const linhas = await db
    .select({ id: contratos.id })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(
      and(
        eq(carteira.supervisorId, supervisorId),
        isNull(carteira.fim),
        eq(contratos.ativo, true),
      ),
    );
  return linhas.map((l) => l.id);
}

/**
 * O cronograma de visitas é automático: o status sai de programacoes.enviada_em
 * e não de marcação manual. A coordenação só sobrescreve em exceção, e aí a
 * marcação manual prevalece (ela grava quem marcou).
 */
async function sincronizarCronograma(mes: string, hoje: string) {
  const [obrigacao] = await db
    .select()
    .from(obrigacoes)
    .where(and(eq(obrigacoes.automatica, true), eq(obrigacoes.ativo, true)));

  if (!obrigacao) return;

  const ocorrencias = await db
    .select()
    .from(obrigacaoOcorrencias)
    .where(
      and(
        eq(obrigacaoOcorrencias.obrigacaoId, obrigacao.id),
        gte(obrigacaoOcorrencias.competencia, primeiroDia(mes)),
        lte(obrigacaoOcorrencias.competencia, ultimoDia(mes)),
        // Marcação manual da coordenação tem precedência e não é sobrescrita.
        isNull(obrigacaoOcorrencias.marcadoPor),
      ),
    );

  if (ocorrencias.length === 0) return;

  const enviadas = await db
    .select({
      supervisorId: programacoes.supervisorId,
      semanaInicio: programacoes.semanaInicio,
      enviadaEm: programacoes.enviadaEm,
    })
    .from(programacoes)
    .where(eq(programacoes.status, 'enviada'));

  for (const oc of ocorrencias) {
    // A competência é a semana em que ele monta; a programação é da seguinte.
    const semanaAlvo = somarDias(oc.competencia, 7);
    const envio = enviadas.find(
      (e) => e.supervisorId === oc.supervisorId && e.semanaInicio === semanaAlvo,
    );

    const novo = statusDoCronograma(envio?.enviadaEm ?? null, oc.prazo, hoje);

    if (novo !== oc.status) {
      await db
        .update(obrigacaoOcorrencias)
        .set({
          status: novo,
          dataEntrega: envio?.enviadaEm ? envio.enviadaEm.toISOString().slice(0, 10) : null,
        })
        .where(eq(obrigacaoOcorrencias.id, oc.id));
    }
  }
}

export async function carregarPrazos(mes: string): Promise<DadosPrazos> {
  const sessao = await requireRole('supervisor');
  const hoje = hojeISO();

  if (sessao.papel !== 'supervisor') {
    await gerarOcorrenciasDoMes(mes);
  }
  await sincronizarCronograma(mes, hoje);

  const todos = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));

  // O supervisor vê a mesma grade, só da própria coluna (seção 8.4).
  const supervisores =
    sessao.papel === 'supervisor' ? todos.filter((s) => s.id === sessao.usuarioId) : todos;

  const ativas = await db
    .select()
    .from(obrigacoes)
    .where(eq(obrigacoes.ativo, true))
    .orderBy(asc(obrigacoes.ordem));

  const ids = supervisores.map((s) => s.id);

  const ocorrencias = ids.length
    ? await db
        .select({
          id: obrigacaoOcorrencias.id,
          obrigacaoId: obrigacaoOcorrencias.obrigacaoId,
          supervisorId: obrigacaoOcorrencias.supervisorId,
          competencia: obrigacaoOcorrencias.competencia,
          prazo: obrigacaoOcorrencias.prazo,
          status: obrigacaoOcorrencias.status,
          dataEntrega: obrigacaoOcorrencias.dataEntrega,
          diasAtendidos: obrigacaoOcorrencias.diasAtendidos,
          diasUteis: obrigacaoOcorrencias.diasUteis,
          observacao: obrigacaoOcorrencias.observacao,
          marcadoEm: obrigacaoOcorrencias.marcadoEm,
          marcadoPorNome: usuarios.nome,
        })
        .from(obrigacaoOcorrencias)
        .leftJoin(usuarios, eq(usuarios.id, obrigacaoOcorrencias.marcadoPor))
        .where(
          and(
            inArray(obrigacaoOcorrencias.supervisorId, ids),
            gte(obrigacaoOcorrencias.competencia, primeiroDia(mes)),
            lte(obrigacaoOcorrencias.competencia, ultimoDia(mes)),
          ),
        )
        .orderBy(asc(obrigacaoOcorrencias.competencia))
    : [];

  const feriadosDoMes = await db
    .select({ data: feriados.data })
    .from(feriados)
    .where(
      and(
        gte(feriados.data, primeiroDia(mes)),
        lte(feriados.data, ultimoDia(mes)),
        eq(feriados.abrangencia, 'nacional'),
      ),
    );

  const linhas: LinhaPrazo[] = ativas.map((bruta) => {
    const o = paraObrigacao(bruta);
    const porSupervisor: Record<string, CelulaPrazo[]> = {};

    for (const s of supervisores) {
      porSupervisor[s.id] = ocorrencias
        .filter((oc) => oc.obrigacaoId === o.id && oc.supervisorId === s.id)
        .map((oc) => ({
          ocorrenciaId: oc.id,
          competencia: oc.competencia,
          prazo: oc.prazo,
          status: oc.status as StatusOcorrencia,
          dataEntrega: oc.dataEntrega,
          diasAtendidos: oc.diasAtendidos,
          diasUteis: oc.diasUteis,
          observacao: oc.observacao,
          marcadoPorNome: oc.marcadoPorNome,
          marcadoEm: oc.marcadoEm,
          automatica: o.automatica,
        }));
    }

    return { obrigacao: o, porSupervisor };
  });

  return {
    mes,
    hoje,
    supervisores,
    linhas,
    diasUteis: diasUteisDoMes(mes, feriadosDoMes.map((f) => f.data)),
  };
}

/* -------------------------------------------------------------------------- */
/* Marcação                                                                    */
/* -------------------------------------------------------------------------- */

const esquemaMarcacao = z.object({
  ocorrenciaId: z.string().uuid('Ocorrência inválida.'),
  status: z.enum(['pendente', 'atendido', 'atendido_atraso', 'nao_atendido', 'nao_aplicavel']),
  dataEntrega: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  diasAtendidos: z.union([z.number().int().min(0), z.null()]),
  observacao: z.string().trim().nullable(),
});

export async function marcarOcorrencia(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  // Marcar prazo é da coordenação: o supervisor vê a grade em leitura.
  const sessao = await requireRole('coordenador');

  const diasBruto = texto(formData.get('diasAtendidos'));

  const dados = esquemaMarcacao.safeParse({
    ocorrenciaId: texto(formData.get('ocorrenciaId')),
    status: texto(formData.get('status')),
    dataEntrega: textoOuNulo(formData.get('dataEntrega')),
    diasAtendidos: diasBruto === '' ? null : Number(diasBruto),
    observacao: textoOuNulo(formData.get('observacao')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const [ocorrencia] = await db
    .select({
      id: obrigacaoOcorrencias.id,
      competencia: obrigacaoOcorrencias.competencia,
      automatica: obrigacoes.automatica,
      recorrencia: obrigacoes.recorrencia,
    })
    .from(obrigacaoOcorrencias)
    .innerJoin(obrigacoes, eq(obrigacoes.id, obrigacaoOcorrencias.obrigacaoId))
    .where(eq(obrigacaoOcorrencias.id, dados.data.ocorrenciaId));

  if (!ocorrencia) return { erro: 'Ocorrência não encontrada.' };

  // Sobrescrever o automático é exceção e exige justificativa (seção 8.2).
  if (ocorrencia.automatica && !dados.data.observacao) {
    return {
      erro: 'O cronograma de visitas é automático. Para sobrescrever, escreva a justificativa.',
    };
  }

  const mes = ocorrencia.competencia.slice(0, 7);

  await db
    .update(obrigacaoOcorrencias)
    .set({
      status: dados.data.status,
      dataEntrega: dados.data.dataEntrega,
      diasAtendidos: dados.data.diasAtendidos,
      diasUteis:
        ocorrencia.recorrencia === 'diaria' ? diasUteisDoMes(mes) : null,
      observacao: dados.data.observacao,
      marcadoPor: sessao.usuarioId,
      marcadoEm: new Date(),
    })
    .where(eq(obrigacaoOcorrencias.id, ocorrencia.id));

  revalidatePath('/prazos');
  revalidatePath('/painel');
  return { ok: true };
}

export async function totalDeDiasNoMes(mes: string) {
  return diasNoMes(mes);
}
