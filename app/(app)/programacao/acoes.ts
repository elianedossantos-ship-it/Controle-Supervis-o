'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, gte, inArray, isNull, lte, max, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carteira, contratos, feriados, programacoes, usuarios, visitas } from '@/db/schema';
import { requireRole, sessaoAtual } from '@/lib/auth';
import type { Periodicidade } from '@/lib/contratos';
import { feriadoAlcancaContrato, type FeriadoRegistro } from '@/lib/feriados-aplicaveis';
import { estadoDaJanela, textoDaJanela, type EstadoJanela } from '@/lib/janela';
import { avaliarTodos, type Aviso } from '@/lib/periodicidade';
import { ehFimDeSemana, mesDaSemana, semanaDe, somarDias, type Semana } from '@/lib/semana';
import { texto } from '@/lib/formulario';

export type ContratoDaGrade = {
  contratoId: string;
  nome: string;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  periodicidade: Periodicidade;
  ultimaRealizada: string | null;
  /** Dias com visita programada ainda em aberto — as únicas células editáveis. */
  marcados: string[];
  /** Dias com visita já realizada. Não se desprograma o que já aconteceu. */
  realizados: string[];
  /** Dias com visita extra. Ela nasce no registro diário, não na montagem. */
  extras: string[];
  /** Dias bloqueados por feriado que alcança este contrato. */
  bloqueados: string[];
};

export type DadosDaSemana = {
  semana: Semana;
  supervisorId: string;
  supervisorNome: string;
  status: 'rascunho' | 'enviada';
  enviadaEm: Date | null;
  avisosNoEnvio: Aviso[] | null;
  /** Decisão 13.1: quinta 00h abre, sexta 18h fecha. */
  janela: EstadoJanela;
  textoJanela: string;
  contratos: ContratoDaGrade[];
  feriados: FeriadoRegistro[];
  avisos: Aviso[];
};

/**
 * Quem o requisitante pode programar. Supervisor só a própria carteira — o
 * isolamento é regra de backend, não de tela (seção 2).
 */
async function resolverSupervisor(supervisorPedido: string | null) {
  const sessao = await requireRole('supervisor');

  if (sessao.papel === 'supervisor') {
    return { id: sessao.usuarioId, nome: sessao.nome, podeEscolher: false };
  }

  // Coordenador e admin fazem tudo do supervisor, em todas as carteiras.
  if (supervisorPedido) {
    const [escolhido] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(eq(usuarios.id, supervisorPedido));

    if (escolhido) return { ...escolhido, podeEscolher: true };
  }

  const [primeiro] = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));

  if (primeiro) return { ...primeiro, podeEscolher: true };
  return { id: sessao.usuarioId, nome: sessao.nome, podeEscolher: true };
}

export async function supervisoresSelecionaveis() {
  const sessao = await requireRole('supervisor');
  if (sessao.papel === 'supervisor') return [];

  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));
}

export async function carregarSemana(
  semanaISO: string,
  supervisorPedido: string | null,
): Promise<DadosDaSemana> {
  const supervisor = await resolverSupervisor(supervisorPedido);
  const semana = semanaDe(semanaISO);

  const [programacao] = await db
    .select()
    .from(programacoes)
    .where(
      and(
        eq(programacoes.supervisorId, supervisor.id),
        eq(programacoes.semanaInicio, semana.inicio),
      ),
    );

  // Contratos da carteira vigente do supervisor.
  const daCarteira = await db
    .select({
      contratoId: contratos.id,
      nome: contratos.nome,
      endereco: contratos.endereco,
      cidade: contratos.cidade,
      uf: contratos.uf,
      periodicidade: contratos.periodicidade,
      ativo: contratos.ativo,
    })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(and(eq(carteira.supervisorId, supervisor.id), isNull(carteira.fim)))
    .orderBy(asc(contratos.nome));

  const ativos = daCarteira.filter((c) => c.ativo);
  const ids = ativos.map((c) => c.contratoId);

  // Visitas da semana, separadas por natureza: só a programada em aberto é
  // editável na grade. Realizada e extra aparecem, mas não se desmarcam.
  const daSemana = ids.length
    ? await db
        .select({
          contratoId: visitas.contratoId,
          dataPrevista: visitas.dataPrevista,
          status: visitas.status,
          origem: visitas.origem,
        })
        .from(visitas)
        .where(
          and(
            eq(visitas.supervisorId, supervisor.id),
            inArray(visitas.contratoId, ids),
            gte(visitas.dataPrevista, semana.inicio),
            lte(visitas.dataPrevista, semana.fim),
            ne(visitas.status, 'cancelada'),
          ),
        )
    : [];

  // Última visita realizada por contrato — alimenta a grade e a regra quinzenal.
  const ultimas = ids.length
    ? await db
        .select({ contratoId: visitas.contratoId, ultima: max(visitas.dataPrevista) })
        .from(visitas)
        .where(and(inArray(visitas.contratoId, ids), eq(visitas.status, 'realizada')))
        .groupBy(visitas.contratoId)
    : [];

  const porContratoUltima = new Map(ultimas.map((u) => [u.contratoId, u.ultima]));

  // Visitas no mês, fora desta semana — alimenta a regra mensal.
  const temNoMes = await contratosComVisitaNoMes(ids, semana);

  // Feriados da semana.
  const feriadosDaSemana = await db
    .select({
      data: feriados.data,
      descricao: feriados.descricao,
      abrangencia: feriados.abrangencia,
      uf: feriados.uf,
      municipio: feriados.municipio,
    })
    .from(feriados)
    .where(and(gte(feriados.data, semana.inicio), lte(feriados.data, semana.fim)));

  const grade: ContratoDaGrade[] = ativos.map((c) => {
    const doContrato = daSemana.filter((v) => v.contratoId === c.contratoId);

    const realizados = doContrato
      .filter((v) => v.status === 'realizada')
      .map((v) => v.dataPrevista);

    const extras = doContrato
      .filter((v) => v.status !== 'realizada' && v.origem !== 'programada')
      .map((v) => v.dataPrevista);

    const marcados = doContrato
      .filter((v) => v.status === 'prevista' && v.origem === 'programada')
      .map((v) => v.dataPrevista);

    const bloqueados = semana.dias.filter((dia) =>
      feriadosDaSemana.some(
        (f) => f.data === dia && feriadoAlcancaContrato(f, { uf: c.uf, cidade: c.cidade }),
      ),
    );

    return {
      contratoId: c.contratoId,
      nome: c.nome,
      endereco: c.endereco,
      cidade: c.cidade,
      uf: c.uf,
      periodicidade: c.periodicidade as Periodicidade,
      ultimaRealizada: porContratoUltima.get(c.contratoId) ?? null,
      marcados,
      realizados,
      extras,
      bloqueados,
    };
  });

  const avisos = avaliarTodos(
    grade.map((c) => ({
      contratoId: c.contratoId,
      contratoNome: c.nome,
      periodicidade: c.periodicidade,
      // Realizada e extra também são visita na semana: contam para a regra.
      programadasNaSemana: c.marcados.length + c.realizados.length + c.extras.length,
      ultimaRealizada: c.ultimaRealizada,
      temVisitaNoMes: temNoMes.has(c.contratoId),
    })),
    semana,
  );

  return {
    semana,
    supervisorId: supervisor.id,
    supervisorNome: supervisor.nome,
    status: (programacao?.status as 'rascunho' | 'enviada') ?? 'rascunho',
    enviadaEm: programacao?.enviadaEm ?? null,
    janela: estadoDaJanela(semana.inicio, new Date()),
    textoJanela: textoDaJanela(semana.inicio, new Date()),
    avisosNoEnvio: (programacao?.avisosNoEnvio as Aviso[] | null) ?? null,
    contratos: grade,
    feriados: feriadosDaSemana,
    avisos,
  };
}

/* -------------------------------------------------------------------------- */
/* Gravação                                                                    */
/* -------------------------------------------------------------------------- */

const esquemaGravacao = z.object({
  semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supervisorId: z.string().uuid(),
  /** 'contratoId|YYYY-MM-DD' de cada célula marcada. */
  celulas: z.array(z.string()),
  enviar: z.boolean(),
  confirmouAvisos: z.boolean(),
});

export type EstadoProgramacao = {
  erro?: string;
  salvo?: boolean;
  enviado?: boolean;
  /** Avisos a confirmar antes do envio. */
  avisosPendentes?: Aviso[];
};

export async function salvarSemana(
  _anterior: EstadoProgramacao,
  formData: FormData,
): Promise<EstadoProgramacao> {
  const sessao = await requireRole('supervisor');

  // Qual botão foi clicado: rascunho, enviar, ou enviar já ciente dos avisos.
  const acao = texto(formData.get('acao'));

  const dados = esquemaGravacao.safeParse({
    semanaInicio: texto(formData.get('semanaInicio')),
    supervisorId: texto(formData.get('supervisorId')),
    celulas: formData.getAll('celula').map(String),
    enviar: acao === 'enviar' || acao === 'enviar-confirmado',
    confirmouAvisos: acao === 'enviar-confirmado',
  });

  if (!dados.success) return { erro: 'Dados da programação inválidos.' };

  const { semanaInicio, supervisorId, celulas, enviar, confirmouAvisos } = dados.data;

  // Supervisor só monta a própria semana, venha o que vier do formulário.
  if (sessao.papel === 'supervisor' && supervisorId !== sessao.usuarioId) {
    return { erro: 'Você só pode montar a própria programação.' };
  }

  const semana = semanaDe(semanaInicio);
  if (semana.inicio !== semanaInicio) {
    return { erro: 'A semana precisa começar numa segunda-feira.' };
  }

  const [programacaoAtual] = await db
    .select()
    .from(programacoes)
    .where(
      and(
        eq(programacoes.supervisorId, supervisorId),
        eq(programacoes.semanaInicio, semana.inicio),
      ),
    );

  // Enviada não se edita. Só execução, cancelamento e visita extra (seção 4.1).
  if (programacaoAtual?.status === 'enviada') {
    return {
      erro: 'Esta programação já foi enviada e não pode mais ser editada.',
    };
  }

  /*
   * Decisão 13.1, a trava da sexta. A coordenação passa por cima em qualquer
   * horário — é ela a saída de emergência da regra, e sem essa saída um
   * esquecimento na sexta deixaria a semana inteira sem programação.
   */
  if (
    sessao.papel === 'supervisor' &&
    estadoDaJanela(semana.inicio, new Date()) === 'fechada'
  ) {
    return {
      erro: 'A janela desta semana fechou às 18h de sexta. Peça à coordenação para reabrir.',
    };
  }

  // Revalida cada célula contra a carteira, o calendário e os feriados. O que
  // veio do formulário é dado de cliente, não fonte de verdade.
  const daCarteira = await db
    .select({
      contratoId: contratos.id,
      cidade: contratos.cidade,
      uf: contratos.uf,
    })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(
      and(
        eq(carteira.supervisorId, supervisorId),
        isNull(carteira.fim),
        eq(contratos.ativo, true),
      ),
    );

  const porId = new Map(daCarteira.map((c) => [c.contratoId, c]));

  const feriadosDaSemana = await db
    .select({
      data: feriados.data,
      descricao: feriados.descricao,
      abrangencia: feriados.abrangencia,
      uf: feriados.uf,
      municipio: feriados.municipio,
    })
    .from(feriados)
    .where(and(gte(feriados.data, semana.inicio), lte(feriados.data, semana.fim)));

  // Visitas da semana que a montagem não governa: realizada (já aconteceu) e
  // extra (nasce no registro diário). Reprogramar por cima duplicaria a visita.
  const intocaveis = await db
    .select({ contratoId: visitas.contratoId, dataPrevista: visitas.dataPrevista })
    .from(visitas)
    .where(
      and(
        eq(visitas.supervisorId, supervisorId),
        gte(visitas.dataPrevista, semana.inicio),
        lte(visitas.dataPrevista, semana.fim),
        ne(visitas.status, 'cancelada'),
        sql`(${visitas.status} = 'realizada' OR ${visitas.origem} <> 'programada')`,
      ),
    );

  const jaExiste = new Set(intocaveis.map((v) => `${v.contratoId}|${v.dataPrevista}`));

  const aGravar: { contratoId: string; dia: string }[] = [];

  for (const celula of celulas) {
    const [contratoId, dia] = celula.split('|');
    const contrato = porId.get(contratoId);

    if (!contrato) return { erro: 'Há contrato fora da carteira na programação.' };
    if (!semana.dias.includes(dia) || ehFimDeSemana(dia)) {
      return { erro: 'Só é possível programar de segunda a sexta.' };
    }

    const bloqueado = feriadosDaSemana.some(
      (f) => f.data === dia && feriadoAlcancaContrato(f, contrato),
    );
    if (bloqueado) return { erro: 'Há visita marcada em dia de feriado.' };

    if (jaExiste.has(celula)) {
      return {
        erro: 'Já existe visita realizada ou extra neste contrato e dia. Ela não se reprograma.',
      };
    }

    if (!aGravar.some((g) => g.contratoId === contratoId && g.dia === dia)) {
      aGravar.push({ contratoId, dia });
    }
  }

  // Avisos de periodicidade: lista antes do envio, com "enviar assim mesmo".
  let avisos: Aviso[] = [];
  if (enviar) {
    const dadosAtuais = await carregarSemana(semana.inicio, supervisorId);

    const contagem = new Map<string, number>();
    for (const g of aGravar) {
      contagem.set(g.contratoId, (contagem.get(g.contratoId) ?? 0) + 1);
    }
    // Realizada e extra na semana também são visita: contam para a regra.
    for (const v of intocaveis) {
      contagem.set(v.contratoId, (contagem.get(v.contratoId) ?? 0) + 1);
    }

    const comVisitaNoMes = await contratosComVisitaNoMes(
      dadosAtuais.contratos.map((c) => c.contratoId),
      semana,
    );

    avisos = avaliarTodos(
      dadosAtuais.contratos.map((c) => ({
        contratoId: c.contratoId,
        contratoNome: c.nome,
        periodicidade: c.periodicidade,
        // O que vale é o que está sendo enviado, não o que está gravado.
        programadasNaSemana: contagem.get(c.contratoId) ?? 0,
        ultimaRealizada: c.ultimaRealizada,
        temVisitaNoMes: comVisitaNoMes.has(c.contratoId),
      })),
      semana,
    );

    if (avisos.length > 0 && !confirmouAvisos) {
      // Grava o rascunho antes de pedir confirmação: o trabalho não se perde.
      await persistir(semana, supervisorId, aGravar, false, null);
      revalidatePath('/programacao');
      return { salvo: true, avisosPendentes: avisos };
    }
  }

  await persistir(semana, supervisorId, aGravar, enviar, enviar ? avisos : null);

  revalidatePath('/programacao');
  revalidatePath('/meu-dia');

  return enviar ? { enviado: true } : { salvo: true };
}

/**
 * Contratos com visita no mês da semana, contando só o que está FORA da semana
 * em edição. As visitas da própria semana entram pela contagem das células:
 * incluí-las aqui contaria o que está prestes a ser apagado e regravado.
 */
async function contratosComVisitaNoMes(
  ids: string[],
  semana: Semana,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const linhas = await db
    .select({ contratoId: visitas.contratoId })
    .from(visitas)
    .where(
      and(
        inArray(visitas.contratoId, ids),
        ne(visitas.status, 'cancelada'),
        sql`to_char(${visitas.dataPrevista}, 'YYYY-MM') = ${mesDaSemana(semana)}`,
        sql`(${visitas.dataPrevista} < ${semana.inicio} OR ${visitas.dataPrevista} > ${semana.fim})`,
      ),
    );

  return new Set(linhas.map((l) => l.contratoId));
}

/**
 * Regrava as visitas previstas da semana. Apaga só o que ainda está 'prevista'
 * e nasceu da programação: visita já realizada, cancelada ou extra não é
 * mexida pela montagem da semana.
 */
async function persistir(
  semana: Semana,
  supervisorId: string,
  celulas: { contratoId: string; dia: string }[],
  enviar: boolean,
  avisos: Aviso[] | null,
) {
  await db.transaction(async (tx) => {
    const [existente] = await tx
      .select()
      .from(programacoes)
      .where(
        and(
          eq(programacoes.supervisorId, supervisorId),
          eq(programacoes.semanaInicio, semana.inicio),
        ),
      );

    let programacaoId = existente?.id;

    if (!programacaoId) {
      const [criada] = await tx
        .insert(programacoes)
        .values({
          supervisorId,
          semanaInicio: semana.inicio,
          semanaFim: semana.fim,
          status: enviar ? 'enviada' : 'rascunho',
          enviadaEm: enviar ? new Date() : null,
          avisosNoEnvio: enviar ? avisos : null,
        })
        .returning({ id: programacoes.id });
      programacaoId = criada.id;
    } else if (enviar) {
      await tx
        .update(programacoes)
        .set({ status: 'enviada', enviadaEm: new Date(), avisosNoEnvio: avisos })
        .where(eq(programacoes.id, programacaoId));
    }

    await tx
      .delete(visitas)
      .where(
        and(
          eq(visitas.supervisorId, supervisorId),
          eq(visitas.status, 'prevista'),
          eq(visitas.origem, 'programada'),
          gte(visitas.dataPrevista, semana.inicio),
          lte(visitas.dataPrevista, semana.fim),
        ),
      );

    if (celulas.length > 0) {
      await tx.insert(visitas).values(
        celulas.map((c) => ({
          programacaoId,
          contratoId: c.contratoId,
          supervisorId,
          dataPrevista: c.dia,
          origem: 'programada' as const,
          status: 'prevista' as const,
        })),
      );
    }
  });
}

/** Reabrir é da coordenação (seção 4.1: "depois disso só a coordenação reabre"). */
export async function reabrirProgramacao(formData: FormData): Promise<void> {
  await requireRole('coordenador');

  const supervisorId = texto(formData.get('supervisorId'));
  const semanaInicio = texto(formData.get('semanaInicio'));
  if (!supervisorId || !semanaInicio) return;

  await db
    .update(programacoes)
    .set({ status: 'rascunho', enviadaEm: null })
    .where(
      and(
        eq(programacoes.supervisorId, supervisorId),
        eq(programacoes.semanaInicio, semanaInicio),
      ),
    );

  revalidatePath('/programacao');
}

export async function papelDaSessao() {
  const sessao = await sessaoAtual();
  return sessao?.papel ?? null;
}

export { somarDias };
