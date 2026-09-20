'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, asc, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  avaliacaoAcoes,
  avaliacaoCompetencias,
  avaliacaoCriterios,
  avaliacaoModelos,
  avaliacaoNotas,
  avaliacoes,
  obrigacaoOcorrencias,
  usuarios,
  visitas,
} from '@/db/schema';
import { requireRole, sessaoAtual } from '@/lib/auth';
import { hojeISO } from '@/lib/datas';
import { texto, textoOuNulo, type EstadoForm } from '@/lib/formulario';
import {
  calcularResultado,
  notasPorCompetencia,
  trimestreDe,
  type ResultadoAvaliacao,
} from '@/lib/avaliacao';
import { aderencia } from '@/lib/indicadores';
import { cumprimentoDePrazos, type StatusOcorrencia } from '@/lib/prazos';

export type CriterioDaTela = {
  id: string;
  codigo: string;
  descricao: string;
  indicadorAuto: string | null;
  /** Número do próprio sistema, exibido ao lado como apoio (seção 9.2). */
  apoio: string | null;
  nota: number | null;
  comentario: string | null;
};

export type CompetenciaDaTela = {
  id: string;
  ordem: number;
  nome: string;
  peso: number;
  criterios: CriterioDaTela[];
};

export type AcaoPDI = {
  id: string;
  ordem: number | null;
  acao: string;
  como: string | null;
  responsavel: string | null;
  prazo: string | null;
  status: string;
};

export type AvaliacaoCompleta = {
  id: string;
  supervisorId: string;
  supervisorNome: string;
  avaliadorNome: string;
  periodoInicio: string;
  periodoFim: string;
  rotuloPeriodo: string;
  status: 'rascunho' | 'finalizada' | 'assinada';
  versaoModelo: string;
  notaFinal: number | null;
  aproveitamento: number | null;
  classificacao: string | null;
  pontosFortes: string | null;
  pontosAtencao: string | null;
  competencias: CompetenciaDaTela[];
  acoes: AcaoPDI[];
  resultado: ResultadoAvaliacao;
};

/* -------------------------------------------------------------------------- */
/* Evidência automática (seção 9.2)                                            */
/* -------------------------------------------------------------------------- */

async function apoioDosIndicadores(
  supervisorId: string,
  inicio: string,
  fim: string,
): Promise<Record<string, string>> {
  const doPeriodo = await db
    .select({ origem: visitas.origem, status: visitas.status })
    .from(visitas)
    .where(
      and(
        eq(visitas.supervisorId, supervisorId),
        gte(visitas.dataPrevista, inicio),
        lte(visitas.dataPrevista, fim),
      ),
    );

  const programadas = doPeriodo.filter((v) => v.origem !== 'extra');
  const valor = aderencia({
    programadas: programadas.length,
    programadasRealizadas: programadas.filter((v) => v.status === 'realizada').length,
    extrasRealizadas: doPeriodo.filter((v) => v.origem === 'extra' && v.status === 'realizada')
      .length,
  });

  const ocorrencias = await db
    .select({ status: obrigacaoOcorrencias.status })
    .from(obrigacaoOcorrencias)
    .where(
      and(
        eq(obrigacaoOcorrencias.supervisorId, supervisorId),
        gte(obrigacaoOcorrencias.competencia, inicio),
        lte(obrigacaoOcorrencias.competencia, fim),
      ),
    );

  const prazos = cumprimentoDePrazos(
    ocorrencias.map((o) => ({ status: o.status as StatusOcorrencia })),
  );

  return {
    aderencia_visitas:
      valor === null
        ? 'sem visita programada no trimestre'
        : `aderência de ${valor.toFixed(1).replace('.', ',')}% no trimestre`,
    cumprimento_prazos:
      prazos.percentual === null
        ? 'sem obrigações no trimestre'
        : `${prazos.percentual.toFixed(1).replace('.', ',')}% das obrigações no prazo` +
          (prazos.atendidosComAtraso > 0
            ? `, mais ${prazos.atendidosComAtraso} com atraso`
            : ''),
  };
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                     */
/* -------------------------------------------------------------------------- */

export async function carregarAvaliacao(id: string): Promise<AvaliacaoCompleta | null> {
  const sessao = await requireRole('supervisor');

  const [a] = await db
    .select({
      id: avaliacoes.id,
      modeloId: avaliacoes.modeloId,
      supervisorId: avaliacoes.supervisorId,
      periodoInicio: avaliacoes.periodoInicio,
      periodoFim: avaliacoes.periodoFim,
      status: avaliacoes.status,
      notaFinal: avaliacoes.notaFinal,
      aproveitamento: avaliacoes.aproveitamento,
      classificacao: avaliacoes.classificacao,
      pontosFortes: avaliacoes.pontosFortes,
      pontosAtencao: avaliacoes.pontosAtencao,
      supervisorNome: usuarios.nome,
    })
    .from(avaliacoes)
    .innerJoin(usuarios, eq(usuarios.id, avaliacoes.supervisorId))
    .where(eq(avaliacoes.id, id));

  if (!a) return null;

  /*
   * Decisão 13.12: o supervisor enxerga a própria avaliação, mas só depois de
   * finalizada. Rascunho é trabalho do avaliador e não fica visível.
   */
  if (sessao.papel === 'supervisor') {
    if (a.supervisorId !== sessao.usuarioId) return null;
    if (a.status === 'rascunho') return null;
  }

  const [avaliador] = await db
    .select({ nome: usuarios.nome })
    .from(avaliacoes)
    .innerJoin(usuarios, eq(usuarios.id, avaliacoes.avaliadorId))
    .where(eq(avaliacoes.id, id));

  const [modelo] = await db
    .select({ versao: avaliacaoModelos.versao })
    .from(avaliacaoModelos)
    .where(eq(avaliacaoModelos.id, a.modeloId));

  const comps = await db
    .select()
    .from(avaliacaoCompetencias)
    .where(eq(avaliacaoCompetencias.modeloId, a.modeloId))
    .orderBy(asc(avaliacaoCompetencias.ordem));

  const criterios = comps.length
    ? await db
        .select()
        .from(avaliacaoCriterios)
        .where(inArray(avaliacaoCriterios.competenciaId, comps.map((c) => c.id)))
        .orderBy(asc(avaliacaoCriterios.ordem))
    : [];

  const notas = await db
    .select()
    .from(avaliacaoNotas)
    .where(eq(avaliacaoNotas.avaliacaoId, a.id));

  const acoes = await db
    .select()
    .from(avaliacaoAcoes)
    .where(eq(avaliacaoAcoes.avaliacaoId, a.id))
    .orderBy(asc(avaliacaoAcoes.ordem));

  const apoio = await apoioDosIndicadores(a.supervisorId, a.periodoInicio, a.periodoFim);

  const competencias: CompetenciaDaTela[] = comps.map((c) => ({
    id: c.id,
    ordem: c.ordem,
    nome: c.nome,
    peso: Number(c.peso),
    criterios: criterios
      .filter((k) => k.competenciaId === c.id)
      .map((k) => {
        const nota = notas.find((n) => n.criterioId === k.id);
        return {
          id: k.id,
          codigo: k.codigo,
          descricao: k.descricao,
          indicadorAuto: k.indicadorAuto,
          apoio: k.indicadorAuto ? (apoio[k.indicadorAuto] ?? null) : null,
          nota: nota?.nota ?? null,
          comentario: nota?.comentario ?? null,
        };
      }),
  }));

  const resultado = calcularResultado(
    notasPorCompetencia(
      competencias.map((c) => ({ id: c.id, nome: c.nome, peso: c.peso })),
      competencias.flatMap((c) =>
        c.criterios.map((k) => ({ criterioId: k.id, competenciaId: c.id, nota: k.nota })),
      ),
      competencias.flatMap((c) => c.criterios.map((k) => ({ id: k.id, competenciaId: c.id }))),
    ),
  );

  return {
    id: a.id,
    supervisorId: a.supervisorId,
    supervisorNome: a.supervisorNome,
    avaliadorNome: avaliador?.nome ?? '',
    periodoInicio: a.periodoInicio,
    periodoFim: a.periodoFim,
    rotuloPeriodo: trimestreDe(a.periodoInicio).rotulo,
    status: a.status as AvaliacaoCompleta['status'],
    versaoModelo: modelo?.versao ?? '',
    notaFinal: a.notaFinal === null ? null : Number(a.notaFinal),
    aproveitamento: a.aproveitamento === null ? null : Number(a.aproveitamento),
    classificacao: a.classificacao,
    pontosFortes: a.pontosFortes,
    pontosAtencao: a.pontosAtencao,
    competencias,
    acoes: acoes.map((x) => ({
      id: x.id,
      ordem: x.ordem,
      acao: x.acao,
      como: x.como,
      responsavel: x.responsavel,
      prazo: x.prazo,
      status: x.status,
    })),
    resultado,
  };
}

export async function listarAvaliacoes() {
  const sessao = await requireRole('supervisor');

  const condicoes =
    sessao.papel === 'supervisor'
      ? [eq(avaliacoes.supervisorId, sessao.usuarioId), ne(avaliacoes.status, 'rascunho')]
      : [];

  return db
    .select({
      id: avaliacoes.id,
      supervisorNome: usuarios.nome,
      periodoInicio: avaliacoes.periodoInicio,
      periodoFim: avaliacoes.periodoFim,
      status: avaliacoes.status,
      notaFinal: avaliacoes.notaFinal,
      aproveitamento: avaliacoes.aproveitamento,
      classificacao: avaliacoes.classificacao,
    })
    .from(avaliacoes)
    .innerJoin(usuarios, eq(usuarios.id, avaliacoes.supervisorId))
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(desc(avaliacoes.periodoInicio), asc(usuarios.nome));
}

export async function supervisoresAvaliaveis() {
  await requireRole('coordenador');
  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));
}

/* -------------------------------------------------------------------------- */
/* Criação                                                                     */
/* -------------------------------------------------------------------------- */

export async function abrirAvaliacao(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('coordenador');

  const supervisorId = texto(formData.get('supervisorId'));
  const referencia = texto(formData.get('trimestre')) || hojeISO();

  if (!z.string().uuid().safeParse(supervisorId).success) {
    return { erro: 'Escolha o supervisor.' };
  }

  const periodo = trimestreDe(`${referencia}-01`.slice(0, 10));

  const [modelo] = await db
    .select({ id: avaliacaoModelos.id })
    .from(avaliacaoModelos)
    .where(eq(avaliacaoModelos.vigente, true))
    .orderBy(desc(avaliacaoModelos.criadoEm));

  if (!modelo) return { erro: 'Nenhum modelo de avaliação vigente.' };

  const [jaExiste] = await db
    .select({ id: avaliacoes.id })
    .from(avaliacoes)
    .where(
      and(
        eq(avaliacoes.supervisorId, supervisorId),
        eq(avaliacoes.periodoInicio, periodo.inicio),
      ),
    );

  if (jaExiste) redirect(`/avaliacoes/${jaExiste.id}`);

  const [criada] = await db
    .insert(avaliacoes)
    .values({
      modeloId: modelo.id,
      supervisorId,
      avaliadorId: sessao.usuarioId,
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
    })
    .returning({ id: avaliacoes.id });

  revalidatePath('/avaliacoes');
  redirect(`/avaliacoes/${criada.id}`);
}

/* -------------------------------------------------------------------------- */
/* Edição                                                                      */
/* -------------------------------------------------------------------------- */

async function exigeRascunho(avaliacaoId: string) {
  await requireRole('coordenador');

  const [a] = await db
    .select({ status: avaliacoes.status })
    .from(avaliacoes)
    .where(eq(avaliacoes.id, avaliacaoId));

  if (!a) return 'Avaliação não encontrada.';
  // Finalizada trava as notas (seção 9.2).
  if (a.status !== 'rascunho') return 'Esta avaliação já foi finalizada e não aceita mudança de nota.';
  return null;
}

export async function salvarNota(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  const criterioId = texto(formData.get('criterioId'));
  const notaBruta = texto(formData.get('nota'));
  const comentario = textoOuNulo(formData.get('comentario'));

  const impedimento = await exigeRascunho(avaliacaoId);
  if (impedimento) return { erro: impedimento };

  // Vazio = não se aplica, e sai do denominador (decisão 13.13).
  const nota = notaBruta === '' ? null : Number(notaBruta);
  if (nota !== null && (!Number.isInteger(nota) || nota < 1 || nota > 5)) {
    return { erro: 'A nota vai de 1 a 5.' };
  }

  await db
    .insert(avaliacaoNotas)
    .values({ avaliacaoId, criterioId, nota, comentario })
    .onConflictDoUpdate({
      target: [avaliacaoNotas.avaliacaoId, avaliacaoNotas.criterioId],
      set: { nota, comentario },
    });

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  return { ok: true };
}

export async function salvarFechamento(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  const impedimento = await exigeRascunho(avaliacaoId);
  if (impedimento) return { erro: impedimento };

  await db
    .update(avaliacoes)
    .set({
      pontosFortes: textoOuNulo(formData.get('pontosFortes')),
      pontosAtencao: textoOuNulo(formData.get('pontosAtencao')),
    })
    .where(eq(avaliacoes.id, avaliacaoId));

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* PDI                                                                         */
/* -------------------------------------------------------------------------- */

export async function adicionarAcao(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  const impedimento = await exigeRascunho(avaliacaoId);
  if (impedimento) return { erro: impedimento };

  const acao = texto(formData.get('acao'));
  if (!acao) return { erro: 'Escreva a ação.' };

  const existentes = await db
    .select({ id: avaliacaoAcoes.id })
    .from(avaliacaoAcoes)
    .where(eq(avaliacaoAcoes.avaliacaoId, avaliacaoId));

  await db.insert(avaliacaoAcoes).values({
    avaliacaoId,
    ordem: existentes.length + 1,
    acao,
    como: textoOuNulo(formData.get('como')),
    responsavel: textoOuNulo(formData.get('responsavel')),
    prazo: textoOuNulo(formData.get('prazo')),
  });

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  return { ok: true };
}

export async function removerAcao(formData: FormData): Promise<void> {
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  if (await exigeRascunho(avaliacaoId)) return;

  const id = texto(formData.get('id'));
  if (id) await db.delete(avaliacaoAcoes).where(eq(avaliacaoAcoes.id, id));

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
}

/** Acompanhamento do PDI: a ação acordada vira pendência do trimestre seguinte. */
export async function concluirAcao(formData: FormData): Promise<void> {
  await requireRole('coordenador');

  const id = texto(formData.get('id'));
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  if (!id) return;

  await db
    .update(avaliacaoAcoes)
    .set({ status: 'concluida' })
    .where(eq(avaliacaoAcoes.id, id));

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
}

/* -------------------------------------------------------------------------- */
/* Finalização e assinatura                                                    */
/* -------------------------------------------------------------------------- */

export async function finalizarAvaliacao(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const avaliacaoId = texto(formData.get('avaliacaoId'));
  const impedimento = await exigeRascunho(avaliacaoId);
  if (impedimento) return { erro: impedimento };

  const completa = await carregarAvaliacao(avaliacaoId);
  if (!completa) return { erro: 'Avaliação não encontrada.' };

  if (completa.resultado.notaFinal === null) {
    return { erro: 'Preencha ao menos um critério antes de finalizar.' };
  }

  await db
    .update(avaliacoes)
    .set({
      status: 'finalizada',
      finalizadaEm: new Date(),
      dataAvaliacao: hojeISO(),
      notaFinal: completa.resultado.notaFinal.toFixed(2),
      aproveitamento: completa.resultado.aproveitamento!.toFixed(2),
      classificacao: completa.resultado.classificacao,
    })
    .where(eq(avaliacoes.id, avaliacaoId));

  revalidatePath('/avaliacoes');
  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  return { ok: true };
}

/**
 * Decisão 13.11: a assinatura é aceite eletrônico dentro do sistema — o próprio
 * supervisor entra e confirma ciência. O PDF continua disponível para arquivo.
 */
export async function assinarAvaliacao(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');
  const avaliacaoId = texto(formData.get('avaliacaoId'));

  const [a] = await db
    .select({ supervisorId: avaliacoes.supervisorId, status: avaliacoes.status })
    .from(avaliacoes)
    .where(eq(avaliacoes.id, avaliacaoId));

  if (!a) return { erro: 'Avaliação não encontrada.' };
  if (a.supervisorId !== sessao.usuarioId) {
    return { erro: 'Só o próprio supervisor dá ciência da sua avaliação.' };
  }
  if (a.status !== 'finalizada') {
    return { erro: 'Só avaliação finalizada pode receber ciência.' };
  }

  await db
    .update(avaliacoes)
    .set({ status: 'assinada' })
    .where(eq(avaliacoes.id, avaliacaoId));

  revalidatePath(`/avaliacoes/${avaliacaoId}`);
  return { ok: true };
}

export async function papelAtual() {
  const sessao = await sessaoAtual();
  return sessao?.papel ?? null;
}
