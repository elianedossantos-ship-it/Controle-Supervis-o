'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  carteira,
  contratos,
  evidencias,
  planoAtualizacoes,
  planosAcao,
  usuarios,
  visitas,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { texto, textoOuNulo, type EstadoForm } from '@/lib/formulario';
import {
  PRIORIDADES,
  estaAberto,
  exigeCoordenacaoParaEncerrar,
  type Prioridade,
  type StatusPlano,
} from '@/lib/planos';
import {
  TAMANHO_MAXIMO,
  guardarEvidencia,
  novaChave,
  tipoAceito,
  urlDaEvidencia,
} from '@/lib/storage';

export type AtualizacaoDoPlano = {
  id: string;
  tipo: string;
  texto: string | null;
  autorNome: string;
  criadoEm: Date;
  fotos: string[];
};

export type PlanoCompleto = {
  id: string;
  contratoId: string;
  contratoNome: string;
  descricao: string;
  localSetor: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  responsavel: string | null;
  status: StatusPlano;
  abertoPorNome: string;
  criadoEm: Date;
  resolvidoEm: Date | null;
  motivoCancelamento: string | null;
  fotos: string[];
  atualizacoes: AtualizacaoDoPlano[];
  exigeCoordenacao: boolean;
};

/** O supervisor só alcança plano de contrato da própria carteira vigente. */
async function podeTocar(contratoId: string, papel: string, usuarioId: string) {
  if (papel !== 'supervisor') return true;

  const [vinculo] = await db
    .select({ id: carteira.id })
    .from(carteira)
    .where(
      and(
        eq(carteira.contratoId, contratoId),
        eq(carteira.supervisorId, usuarioId),
        isNull(carteira.fim),
      ),
    );

  return Boolean(vinculo);
}

async function fotosDe(planoIds: string[], atualizacaoIds: string[]) {
  if (planoIds.length === 0 && atualizacaoIds.length === 0) return [];

  const condicoes = [];
  if (planoIds.length) condicoes.push(inArray(evidencias.planoId, planoIds));
  if (atualizacaoIds.length) condicoes.push(inArray(evidencias.atualizacaoId, atualizacaoIds));

  return db
    .select({
      arquivoUrl: evidencias.arquivoUrl,
      planoId: evidencias.planoId,
      atualizacaoId: evidencias.atualizacaoId,
    })
    .from(evidencias)
    .where(or(...condicoes));
}

export async function carregarPlano(id: string): Promise<PlanoCompleto | null> {
  const sessao = await requireRole('supervisor');

  const [p] = await db
    .select({
      id: planosAcao.id,
      contratoId: planosAcao.contratoId,
      contratoNome: contratos.nome,
      descricao: planosAcao.descricao,
      localSetor: planosAcao.localSetor,
      prioridade: planosAcao.prioridade,
      prazo: planosAcao.prazo,
      responsavel: planosAcao.responsavel,
      status: planosAcao.status,
      criadoEm: planosAcao.criadoEm,
      resolvidoEm: planosAcao.resolvidoEm,
      motivoCancelamento: planosAcao.motivoCancelamento,
      abertoPorNome: usuarios.nome,
    })
    .from(planosAcao)
    .innerJoin(contratos, eq(contratos.id, planosAcao.contratoId))
    .innerJoin(usuarios, eq(usuarios.id, planosAcao.abertoPor))
    .where(eq(planosAcao.id, id));

  if (!p) return null;
  if (!(await podeTocar(p.contratoId, sessao.papel, sessao.usuarioId))) return null;

  const atualizacoes = await db
    .select({
      id: planoAtualizacoes.id,
      tipo: planoAtualizacoes.tipo,
      texto: planoAtualizacoes.texto,
      criadoEm: planoAtualizacoes.criadoEm,
      autorNome: usuarios.nome,
    })
    .from(planoAtualizacoes)
    .innerJoin(usuarios, eq(usuarios.id, planoAtualizacoes.autorId))
    .where(eq(planoAtualizacoes.planoId, id))
    .orderBy(asc(planoAtualizacoes.criadoEm));

  const fotos = await fotosDe([id], atualizacoes.map((a) => a.id));

  return {
    ...p,
    prioridade: p.prioridade as Prioridade,
    status: p.status as StatusPlano,
    exigeCoordenacao: exigeCoordenacaoParaEncerrar(p.prioridade as Prioridade),
    fotos: fotos.filter((f) => f.planoId === id).map((f) => f.arquivoUrl),
    atualizacoes: atualizacoes.map((a) => ({
      ...a,
      fotos: fotos.filter((f) => f.atualizacaoId === a.id).map((f) => f.arquivoUrl),
    })),
  };
}

export type PlanoResumido = {
  id: string;
  contratoId: string;
  contratoNome: string;
  descricao: string;
  prioridade: Prioridade;
  prazo: string | null;
  status: StatusPlano;
  supervisorNome: string | null;
  criadoEm: Date;
  atualizacoes: number;
};

export async function listarPlanos(filtros: {
  contratoId?: string | null;
  apenasAbertos?: boolean;
}): Promise<PlanoResumido[]> {
  const sessao = await requireRole('supervisor');

  const condicoes = [];
  if (filtros.contratoId) condicoes.push(eq(planosAcao.contratoId, filtros.contratoId));
  if (filtros.apenasAbertos) {
    condicoes.push(inArray(planosAcao.status, ['aberto', 'em_andamento']));
  }
  // Isolamento por carteira também aqui.
  if (sessao.papel === 'supervisor') {
    condicoes.push(eq(carteira.supervisorId, sessao.usuarioId));
    condicoes.push(isNull(carteira.fim));
  }

  const linhas = await db
    .select({
      id: planosAcao.id,
      contratoId: planosAcao.contratoId,
      contratoNome: contratos.nome,
      descricao: planosAcao.descricao,
      prioridade: planosAcao.prioridade,
      prazo: planosAcao.prazo,
      status: planosAcao.status,
      criadoEm: planosAcao.criadoEm,
      supervisorNome: usuarios.nome,
    })
    .from(planosAcao)
    .innerJoin(contratos, eq(contratos.id, planosAcao.contratoId))
    .leftJoin(
      carteira,
      and(eq(carteira.contratoId, planosAcao.contratoId), isNull(carteira.fim)),
    )
    .leftJoin(usuarios, eq(usuarios.id, carteira.supervisorId))
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(asc(planosAcao.prazo), desc(planosAcao.criadoEm));

  const ids = linhas.map((l) => l.id);
  const contagem = ids.length
    ? await db
        .select({ planoId: planoAtualizacoes.planoId })
        .from(planoAtualizacoes)
        .where(inArray(planoAtualizacoes.planoId, ids))
    : [];

  return linhas.map((l) => ({
    ...l,
    prioridade: l.prioridade as Prioridade,
    status: l.status as StatusPlano,
    atualizacoes: contagem.filter((c) => c.planoId === l.id).length,
  }));
}

/** Planos abertos por contrato — alimenta o selo do Meu dia. */
export async function planosAbertosPorContrato(
  contratoIds: string[],
): Promise<Record<string, number>> {
  if (contratoIds.length === 0) return {};

  const linhas = await db
    .select({ contratoId: planosAcao.contratoId })
    .from(planosAcao)
    .where(
      and(
        inArray(planosAcao.contratoId, contratoIds),
        inArray(planosAcao.status, ['aberto', 'em_andamento']),
      ),
    );

  const mapa: Record<string, number> = {};
  for (const l of linhas) mapa[l.contratoId] = (mapa[l.contratoId] ?? 0) + 1;
  return mapa;
}

/* -------------------------------------------------------------------------- */
/* Abertura                                                                    */
/* -------------------------------------------------------------------------- */

async function guardarFotos(
  formData: FormData,
  campo: string,
  obrigatoria: boolean,
): Promise<{ erro?: string; chaves: string[]; quando: Date }> {
  const arquivos = formData
    .getAll(campo)
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (arquivos.length === 0) {
    return obrigatoria
      ? { erro: 'Tire ao menos uma foto.', chaves: [], quando: new Date() }
      : { chaves: [], quando: new Date() };
  }

  for (const a of arquivos) {
    if (!tipoAceito(a.type)) return { erro: 'A evidência precisa ser uma foto.', chaves: [], quando: new Date() };
    if (a.size > TAMANHO_MAXIMO) return { erro: 'Foto acima de 15 MB.', chaves: [], quando: new Date() };
  }

  const quando = new Date();
  const chaves: string[] = [];

  for (const a of arquivos) {
    const chave = novaChave(a.type, quando);
    await guardarEvidencia(chave, new Uint8Array(await a.arrayBuffer()), a.type);
    chaves.push(chave);
  }

  return { chaves, quando };
}

const esquemaAbertura = z.object({
  contratoId: z.string().uuid('Contrato inválido.'),
  visitaId: z.union([z.string().uuid(), z.null()]),
  descricao: z.string().trim().min(1, 'Descreva o problema.'),
  localSetor: z.string().trim().nullable(),
  prioridade: z.enum(PRIORIDADES),
  prazo: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  responsavel: z.string().trim().nullable(),
});

export async function abrirPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');

  const dados = esquemaAbertura.safeParse({
    contratoId: texto(formData.get('contratoId')),
    visitaId: textoOuNulo(formData.get('visitaId')),
    descricao: texto(formData.get('descricao')),
    localSetor: textoOuNulo(formData.get('localSetor')),
    prioridade: texto(formData.get('prioridade')) || 'normal',
    prazo: textoOuNulo(formData.get('prazo')),
    responsavel: textoOuNulo(formData.get('responsavel')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  if (!(await podeTocar(dados.data.contratoId, sessao.papel, sessao.usuarioId))) {
    return { erro: 'Este contrato não está na sua carteira.' };
  }

  // A visita de origem, quando houver, precisa ser do mesmo contrato.
  if (dados.data.visitaId) {
    const [v] = await db
      .select({ contratoId: visitas.contratoId })
      .from(visitas)
      .where(eq(visitas.id, dados.data.visitaId));
    if (!v || v.contratoId !== dados.data.contratoId) {
      return { erro: 'A visita de origem não é deste contrato.' };
    }
  }

  const foto = await guardarFotos(formData, 'foto', false);
  if (foto.erro) return { erro: foto.erro };

  await db.transaction(async (tx) => {
    const [criado] = await tx
      .insert(planosAcao)
      .values({
        contratoId: dados.data.contratoId,
        visitaOrigemId: dados.data.visitaId,
        abertoPor: sessao.usuarioId,
        descricao: dados.data.descricao,
        localSetor: dados.data.localSetor,
        prioridade: dados.data.prioridade,
        prazo: dados.data.prazo,
        responsavel: dados.data.responsavel,
      })
      .returning({ id: planosAcao.id });

    if (foto.chaves.length > 0) {
      await tx.insert(evidencias).values(
        foto.chaves.map((c) => ({
          planoId: criado.id,
          arquivoUrl: urlDaEvidencia(c),
          capturadoEm: foto.quando,
        })),
      );
    }
  });

  revalidatePath('/planos');
  revalidatePath('/meu-dia');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Atualizações — histórico somente-acréscimo                                  */
/* -------------------------------------------------------------------------- */

export async function acompanharPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');
  const planoId = texto(formData.get('planoId'));
  const comentario = texto(formData.get('texto'));

  const plano = await carregarPlano(planoId);
  if (!plano) return { erro: 'Plano não encontrado.' };
  if (!estaAberto(plano.status)) return { erro: 'Este plano já foi encerrado.' };
  if (!comentario) return { erro: 'Escreva o acompanhamento.' };

  const foto = await guardarFotos(formData, 'foto', false);
  if (foto.erro) return { erro: foto.erro };

  await db.transaction(async (tx) => {
    const [at] = await tx
      .insert(planoAtualizacoes)
      .values({
        planoId,
        visitaId: textoOuNulo(formData.get('visitaId')),
        autorId: sessao.usuarioId,
        tipo: 'acompanhamento',
        texto: comentario,
      })
      .returning({ id: planoAtualizacoes.id });

    if (foto.chaves.length > 0) {
      await tx.insert(evidencias).values(
        foto.chaves.map((c) => ({
          atualizacaoId: at.id,
          arquivoUrl: urlDaEvidencia(c),
          capturadoEm: foto.quando,
        })),
      );
    }

    // Um acompanhamento move o plano para "em andamento" (seção 10.2).
    if (plano.status === 'aberto') {
      await tx
        .update(planosAcao)
        .set({ status: 'em_andamento' })
        .where(eq(planosAcao.id, planoId));
    }
  });

  revalidatePath('/planos');
  return { ok: true };
}

export async function editarPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');
  const planoId = texto(formData.get('planoId'));

  const plano = await carregarPlano(planoId);
  if (!plano) return { erro: 'Plano não encontrado.' };
  if (!estaAberto(plano.status)) return { erro: 'Este plano já foi encerrado.' };

  const descricao = texto(formData.get('descricao'));
  const prazo = textoOuNulo(formData.get('prazo'));
  const prioridade = texto(formData.get('prioridade')) as Prioridade;

  if (!descricao) return { erro: 'A descrição não pode ficar vazia.' };
  if (!PRIORIDADES.includes(prioridade)) return { erro: 'Prioridade inválida.' };

  // Editar também grava registro: plano que pode ser reescrito em silêncio não
  // serve de evidência (seção 10.2).
  const mudancas: string[] = [];
  if (descricao !== plano.descricao) mudancas.push('descrição');
  if (prazo !== plano.prazo) {
    mudancas.push(`prazo de ${plano.prazo ?? 'sem prazo'} para ${prazo ?? 'sem prazo'}`);
  }
  if (prioridade !== plano.prioridade) {
    mudancas.push(`prioridade de ${plano.prioridade} para ${prioridade}`);
  }

  if (mudancas.length === 0) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(planosAcao)
      .set({ descricao, prazo, prioridade })
      .where(eq(planosAcao.id, planoId));

    await tx.insert(planoAtualizacoes).values({
      planoId,
      autorId: sessao.usuarioId,
      tipo: 'edicao',
      texto: `Alterou ${mudancas.join('; ')}.`,
    });
  });

  revalidatePath('/planos');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Encerramento                                                                */
/* -------------------------------------------------------------------------- */

export async function resolverPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');
  const planoId = texto(formData.get('planoId'));

  const plano = await carregarPlano(planoId);
  if (!plano) return { erro: 'Plano não encontrado.' };
  if (!estaAberto(plano.status)) return { erro: 'Este plano já foi encerrado.' };

  // Decisão 13.16: alta e crítica só a coordenação encerra.
  if (plano.exigeCoordenacao && sessao.papel === 'supervisor') {
    return {
      erro: 'Plano de prioridade alta ou crítica é encerrado pela coordenação.',
    };
  }

  // Resolver exige foto da solução (seção 10.2).
  const foto = await guardarFotos(formData, 'foto', true);
  if (foto.erro) return { erro: foto.erro };

  await db.transaction(async (tx) => {
    const [at] = await tx
      .insert(planoAtualizacoes)
      .values({
        planoId,
        autorId: sessao.usuarioId,
        tipo: 'resolucao',
        texto: textoOuNulo(formData.get('texto')),
      })
      .returning({ id: planoAtualizacoes.id });

    await tx.insert(evidencias).values(
      foto.chaves.map((c) => ({
        atualizacaoId: at.id,
        arquivoUrl: urlDaEvidencia(c),
        capturadoEm: foto.quando,
      })),
    );

    await tx
      .update(planosAcao)
      .set({ status: 'resolvido', resolvidoEm: new Date(), resolvidoPor: sessao.usuarioId })
      .where(eq(planosAcao.id, planoId));
  });

  revalidatePath('/planos');
  revalidatePath('/meu-dia');
  return { ok: true };
}

export async function cancelarPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');
  const planoId = texto(formData.get('planoId'));
  const motivo = texto(formData.get('motivo'));

  const plano = await carregarPlano(planoId);
  if (!plano) return { erro: 'Plano não encontrado.' };
  if (!estaAberto(plano.status)) return { erro: 'Este plano já foi encerrado.' };
  // Cancelar exige justificativa em texto (seção 10.2).
  if (!motivo) return { erro: 'Escreva por que o plano está sendo cancelado.' };

  if (plano.exigeCoordenacao && sessao.papel === 'supervisor') {
    return { erro: 'Plano de prioridade alta ou crítica é encerrado pela coordenação.' };
  }

  await db.transaction(async (tx) => {
    await tx.insert(planoAtualizacoes).values({
      planoId,
      autorId: sessao.usuarioId,
      tipo: 'cancelamento',
      texto: motivo,
    });

    await tx
      .update(planosAcao)
      .set({ status: 'cancelado', motivoCancelamento: motivo })
      .where(eq(planosAcao.id, planoId));
  });

  revalidatePath('/planos');
  revalidatePath('/meu-dia');
  return { ok: true };
}

/** Reabrir é da coordenação (seção 10.2). */
export async function reabrirPlano(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('coordenador');
  const planoId = texto(formData.get('planoId'));
  const motivo = texto(formData.get('motivo'));

  const [plano] = await db
    .select({ status: planosAcao.status })
    .from(planosAcao)
    .where(eq(planosAcao.id, planoId));

  if (!plano) return { erro: 'Plano não encontrado.' };
  if (estaAberto(plano.status as StatusPlano)) return { erro: 'Este plano já está aberto.' };
  if (!motivo) return { erro: 'Escreva por que o plano está sendo reaberto.' };

  await db.transaction(async (tx) => {
    await tx.insert(planoAtualizacoes).values({
      planoId,
      autorId: sessao.usuarioId,
      tipo: 'reabertura',
      texto: motivo,
    });

    await tx
      .update(planosAcao)
      .set({
        status: 'em_andamento',
        resolvidoEm: null,
        resolvidoPor: null,
        motivoCancelamento: null,
      })
      .where(eq(planosAcao.id, planoId));
  });

  revalidatePath('/planos');
  return { ok: true };
}

export async function contratosParaPlano() {
  const sessao = await requireRole('supervisor');

  if (sessao.papel !== 'supervisor') {
    return db
      .select({ id: contratos.id, nome: contratos.nome })
      .from(contratos)
      .where(eq(contratos.ativo, true))
      .orderBy(asc(contratos.nome));
  }

  return db
    .select({ id: contratos.id, nome: contratos.nome })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(
      and(
        eq(carteira.supervisorId, sessao.usuarioId),
        isNull(carteira.fim),
        eq(contratos.ativo, true),
      ),
    )
    .orderBy(asc(contratos.nome));
}
