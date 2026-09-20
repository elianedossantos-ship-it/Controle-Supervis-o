'use server';

import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  carteira,
  contratos,
  demandasExtras,
  evidencias,
  motivosCancelamento,
  obrigacaoOcorrencias,
  obrigacoes,
  usuarios,
  visitas,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import type { Periodicidade } from '@/lib/contratos';
import { hojeISO } from '@/lib/datas';
import {
  cumprimentoDePrazos,
  prazosEmAtraso,
  type CumprimentoPrazos,
  type StatusOcorrencia,
} from '@/lib/prazos';
import {
  aderencia,
  cumprimentoDaPeriodicidade,
  percentualDeExtras,
  ranquearMotivos,
  resumirDemandas,
  type CumprimentoPeriodicidade,
  type PeriodoAvaliado,
  type RankingMotivos,
  type ResumoDemandas,
} from '@/lib/indicadores';

export type Filtros = {
  periodo: PeriodoAvaliado;
  supervisorId: string | null;
  contratoId: string | null;
};

export type LinhaAderencia = {
  id: string;
  nome: string;
  programadas: number;
  programadasRealizadas: number;
  extrasRealizadas: number;
  canceladas: number;
  aderencia: number | null;
};

export type Cancelamento = {
  visitaId: string;
  data: string;
  contratoNome: string;
  supervisorNome: string;
  motivo: string | null;
  motivoOutro: string | null;
};

export type SemVisita = {
  contratoId: string;
  nome: string;
  periodicidade: string;
  supervisorNome: string | null;
};

export type SemLocalizacao = {
  visitaId: string;
  data: string;
  contratoNome: string;
  supervisorNome: string;
  realizadaEm: Date | null;
};

export type DadosPainel = {
  filtros: Filtros;
  totais: {
    programadas: number;
    programadasRealizadas: number;
    extrasRealizadas: number;
    totalRealizadas: number;
    canceladas: number;
    previstas: number;
    aderencia: number | null;
    percentualExtras: number | null;
  };
  porSupervisor: LinhaAderencia[];
  porContrato: LinhaAderencia[];
  motivos: RankingMotivos;
  cancelamentos: Cancelamento[];
  periodicidade: CumprimentoPeriodicidade;
  semVisita: SemVisita[];
  semLocalizacao: SemLocalizacao[];
  demandas: ResumoDemandas;
  prazos: CumprimentoPrazos & {
    emAtraso: number;
    porObrigacao: { nome: string; cumprimento: CumprimentoPrazos }[];
  };
  supervisores: { id: string; nome: string }[];
  contratos: { id: string; nome: string }[];
};

/** Recorte comum a quase toda consulta do painel. */
function recorte(f: Filtros) {
  const condicoes = [
    gte(visitas.dataPrevista, f.periodo.inicio),
    lte(visitas.dataPrevista, f.periodo.fim),
  ];
  if (f.supervisorId) condicoes.push(eq(visitas.supervisorId, f.supervisorId));
  if (f.contratoId) condicoes.push(eq(visitas.contratoId, f.contratoId));
  return and(...condicoes);
}

export async function carregarPainel(f: Filtros): Promise<DadosPainel> {
  await requireRole('coordenador');

  // Uma varredura das visitas do período alimenta quase todos os indicadores.
  const doPeriodo = await db
    .select({
      id: visitas.id,
      contratoId: visitas.contratoId,
      contratoNome: contratos.nome,
      periodicidade: contratos.periodicidade,
      supervisorId: visitas.supervisorId,
      supervisorNome: usuarios.nome,
      data: visitas.dataPrevista,
      origem: visitas.origem,
      status: visitas.status,
      realizadaEm: visitas.realizadaEm,
      motivo: motivosCancelamento.descricao,
      motivoCategoria: motivosCancelamento.categoria,
      motivoOutro: visitas.motivoOutro,
    })
    .from(visitas)
    .innerJoin(contratos, eq(contratos.id, visitas.contratoId))
    .innerJoin(usuarios, eq(usuarios.id, visitas.supervisorId))
    .leftJoin(motivosCancelamento, eq(motivosCancelamento.id, visitas.motivoId))
    .where(recorte(f))
    .orderBy(asc(visitas.dataPrevista));

  const ehProgramada = (v: (typeof doPeriodo)[number]) => v.origem !== 'extra';
  const realizada = (v: (typeof doPeriodo)[number]) => v.status === 'realizada';

  const programadas = doPeriodo.filter(ehProgramada);
  const programadasRealizadas = programadas.filter(realizada);
  const extrasRealizadas = doPeriodo.filter((v) => v.origem === 'extra' && realizada(v));
  const canceladas = doPeriodo.filter((v) => v.status === 'cancelada');
  const previstas = doPeriodo.filter((v) => v.status === 'prevista');
  const totalRealizadas = programadasRealizadas.length + extrasRealizadas.length;

  /** Agrupa por supervisor ou por contrato, com a mesma fórmula de aderência. */
  function agrupar(chave: 'supervisor' | 'contrato'): LinhaAderencia[] {
    const mapa = new Map<string, LinhaAderencia>();

    for (const v of doPeriodo) {
      const id = chave === 'supervisor' ? v.supervisorId : v.contratoId;
      const nome = chave === 'supervisor' ? v.supervisorNome : v.contratoNome;

      const linha =
        mapa.get(id) ??
        {
          id,
          nome,
          programadas: 0,
          programadasRealizadas: 0,
          extrasRealizadas: 0,
          canceladas: 0,
          aderencia: null,
        };

      if (ehProgramada(v)) {
        linha.programadas++;
        if (realizada(v)) linha.programadasRealizadas++;
      } else if (realizada(v)) {
        linha.extrasRealizadas++;
      }
      if (v.status === 'cancelada') linha.canceladas++;

      mapa.set(id, linha);
    }

    return [...mapa.values()]
      .map((l) => ({ ...l, aderencia: aderencia(l) }))
      .sort((a, b) => (a.aderencia ?? -1) - (b.aderencia ?? -1));
  }

  // Cancelamentos por motivo, ranqueados.
  const contagemMotivos = new Map<string, { categoria: string | null; n: number }>();
  for (const c of canceladas) {
    const chave = c.motivo ?? 'Sem motivo registrado';
    const atual = contagemMotivos.get(chave) ?? { categoria: c.motivoCategoria, n: 0 };
    atual.n++;
    contagemMotivos.set(chave, atual);
  }

  const motivos = ranquearMotivos(
    [...contagemMotivos.entries()].map(([descricao, v]) => ({
      descricao,
      categoria: v.categoria,
      quantidade: v.n,
    })),
  );

  // Cumprimento da periodicidade: contratos ativos do recorte.
  const contratosDoRecorte = await contratosAtivos(f);
  const realizadasPorContrato = new Map<string, number>();
  for (const v of [...programadasRealizadas, ...extrasRealizadas]) {
    realizadasPorContrato.set(
      v.contratoId,
      (realizadasPorContrato.get(v.contratoId) ?? 0) + 1,
    );
  }

  const periodicidade = cumprimentoDaPeriodicidade(
    contratosDoRecorte.map((c) => ({
      contratoId: c.id,
      contratoNome: c.nome,
      periodicidade: c.periodicidade as Periodicidade,
      realizadas: realizadasPorContrato.get(c.id) ?? 0,
    })),
    f.periodo,
  );

  const semVisita: SemVisita[] = contratosDoRecorte
    .filter((c) => (realizadasPorContrato.get(c.id) ?? 0) === 0)
    .map((c) => ({
      contratoId: c.id,
      nome: c.nome,
      periodicidade: c.periodicidade,
      supervisorNome: c.supervisorNome,
    }));

  // Visitas realizadas sem GPS: nenhuma evidência com latitude.
  const idsRealizadas = [...programadasRealizadas, ...extrasRealizadas].map((v) => v.id);
  const comGps = idsRealizadas.length
    ? await db
        .select({ visitaId: evidencias.visitaId })
        .from(evidencias)
        .where(
          and(
            isNotNull(evidencias.latitude),
            inArray(evidencias.visitaId, idsRealizadas),
          ),
        )
    : [];

  const conjuntoComGps = new Set(comGps.map((e) => e.visitaId));

  const semLocalizacao: SemLocalizacao[] = [...programadasRealizadas, ...extrasRealizadas]
    .filter((v) => !conjuntoComGps.has(v.id))
    .map((v) => ({
      visitaId: v.id,
      data: v.data,
      contratoNome: v.contratoNome,
      supervisorNome: v.supervisorNome,
      realizadaEm: v.realizadaEm,
    }));

  // Demandas extras do período.
  const demandasCondicoes = [
    gte(sql`${demandasExtras.criadoEm}::date`, f.periodo.inicio),
    lte(sql`${demandasExtras.criadoEm}::date`, f.periodo.fim),
    ne(demandasExtras.status, 'cancelada'),
  ];
  if (f.supervisorId) demandasCondicoes.push(eq(demandasExtras.supervisorId, f.supervisorId));
  if (f.contratoId) demandasCondicoes.push(eq(demandasExtras.contratoId, f.contratoId));

  const linhasDemandas = await db
    .select({
      status: demandasExtras.status,
      criadoEm: demandasExtras.criadoEm,
      concluidaEm: demandasExtras.concluidaEm,
    })
    .from(demandasExtras)
    .where(and(...demandasCondicoes));

  const demandas = resumirDemandas(
    linhasDemandas.filter((d) => d.status === 'aberta').length,
    linhasDemandas
      .filter((d) => d.status === 'concluida')
      .map((d) => ({ criadoEm: d.criadoEm, concluidaEm: d.concluidaEm })),
  );

  /*
   * Prazos e obrigações (seção 8). O recorte é pela competência da ocorrência
   * dentro do período filtrado; o filtro de contrato não se aplica, porque a
   * obrigação padrão é do supervisor, não da unidade.
   */
  const condicoesPrazos = [
    gte(obrigacaoOcorrencias.competencia, f.periodo.inicio),
    lte(obrigacaoOcorrencias.competencia, f.periodo.fim),
  ];
  if (f.supervisorId) {
    condicoesPrazos.push(eq(obrigacaoOcorrencias.supervisorId, f.supervisorId));
  }

  const ocorrencias = await db
    .select({
      status: obrigacaoOcorrencias.status,
      prazo: obrigacaoOcorrencias.prazo,
      marcadoEm: obrigacaoOcorrencias.marcadoEm,
      obrigacaoNome: obrigacoes.nome,
      ordem: obrigacoes.ordem,
    })
    .from(obrigacaoOcorrencias)
    .innerJoin(obrigacoes, eq(obrigacoes.id, obrigacaoOcorrencias.obrigacaoId))
    .where(and(...condicoesPrazos))
    .orderBy(asc(obrigacoes.ordem));

  const tipadas = ocorrencias.map((o) => ({
    ...o,
    status: o.status as StatusOcorrencia,
  }));

  const nomesObrigacoes = [...new Set(tipadas.map((o) => o.obrigacaoNome))];

  const prazos = {
    ...cumprimentoDePrazos(tipadas),
    emAtraso: prazosEmAtraso(tipadas, hojeISO()),
    porObrigacao: nomesObrigacoes.map((nome) => ({
      nome,
      cumprimento: cumprimentoDePrazos(tipadas.filter((o) => o.obrigacaoNome === nome)),
    })),
  };

  const [listaSupervisores, listaContratos] = await Promise.all([
    db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
      .orderBy(asc(usuarios.nome)),
    db
      .select({ id: contratos.id, nome: contratos.nome })
      .from(contratos)
      .where(eq(contratos.ativo, true))
      .orderBy(asc(contratos.nome)),
  ]);

  return {
    filtros: f,
    totais: {
      programadas: programadas.length,
      programadasRealizadas: programadasRealizadas.length,
      extrasRealizadas: extrasRealizadas.length,
      totalRealizadas,
      canceladas: canceladas.length,
      previstas: previstas.length,
      aderencia: aderencia({
        programadas: programadas.length,
        programadasRealizadas: programadasRealizadas.length,
        extrasRealizadas: extrasRealizadas.length,
      }),
      percentualExtras: percentualDeExtras(extrasRealizadas.length, totalRealizadas),
    },
    porSupervisor: agrupar('supervisor'),
    porContrato: agrupar('contrato'),
    motivos,
    cancelamentos: canceladas.map((c) => ({
      visitaId: c.id,
      data: c.data,
      contratoNome: c.contratoNome,
      supervisorNome: c.supervisorNome,
      motivo: c.motivo,
      motivoOutro: c.motivoOutro,
    })),
    periodicidade,
    semVisita,
    semLocalizacao,
    demandas,
    prazos,
    supervisores: listaSupervisores,
    contratos: listaContratos,
  };
}

/** Contratos ativos com carteira vigente, respeitando os filtros. */
async function contratosAtivos(f: Filtros) {
  const condicoes = [eq(contratos.ativo, true), isNull(carteira.fim)];
  if (f.supervisorId) condicoes.push(eq(carteira.supervisorId, f.supervisorId));
  if (f.contratoId) condicoes.push(eq(contratos.id, f.contratoId));

  return db
    .select({
      id: contratos.id,
      nome: contratos.nome,
      periodicidade: contratos.periodicidade,
      supervisorNome: usuarios.nome,
    })
    .from(contratos)
    .innerJoin(carteira, eq(carteira.contratoId, contratos.id))
    .innerJoin(usuarios, eq(usuarios.id, carteira.supervisorId))
    .where(and(...condicoes))
    .orderBy(asc(contratos.nome));
}

/** Contratos da carteira vigente de um supervisor — alimenta o seletor da demanda. */
export async function contratosDoSupervisor(supervisorId: string) {
  await requireRole('coordenador');

  return db
    .select({ id: contratos.id, nome: contratos.nome })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(
      and(
        eq(carteira.supervisorId, supervisorId),
        isNull(carteira.fim),
        eq(contratos.ativo, true),
      ),
    )
    .orderBy(asc(contratos.nome));
}
