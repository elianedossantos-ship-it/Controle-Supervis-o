'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  carteira,
  contatosContrato,
  contratos,
  demandasExtras,
  evidencias,
  motivosCancelamento,
  usuarios,
  visitas,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { texto, textoOuNulo, type EstadoForm } from '@/lib/formulario';
import {
  TAMANHO_MAXIMO,
  guardarEvidencia,
  novaChave,
  tipoAceito,
  urlDaEvidencia,
} from '@/lib/storage';

export type ContatoDoContrato = {
  nome: string;
  cargo: string | null;
  telefone: string | null;
  principal: boolean;
};

export type VisitaDoDia = {
  id: string;
  contratoId: string;
  contratoNome: string;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  periodicidade: string;
  observacoes: string | null;
  origem: string;
  status: string;
  dataPrevista: string;
  realizadaEm: Date | null;
  motivoDescricao: string | null;
  motivoOutro: string | null;
  observacao: string | null;
  temLocalizacao: boolean;
  fotos: string[];
  contatos: ContatoDoContrato[];
};

export type DemandaAberta = {
  id: string;
  descricao: string;
  prioridade: string | null;
  dataAlvo: string | null;
  contratoNome: string | null;
  criadaPor: string;
};

export type DadosMeuDia = {
  dia: string;
  supervisorId: string;
  supervisorNome: string;
  demandas: DemandaAberta[];
  visitas: VisitaDoDia[];
  motivos: { id: string; descricao: string; exigeTexto: boolean }[];
  contratosDaCarteira: { id: string; nome: string }[];
};

async function resolverSupervisor(pedido: string | null) {
  const sessao = await requireRole('supervisor');

  if (sessao.papel === 'supervisor') {
    return { id: sessao.usuarioId, nome: sessao.nome };
  }

  if (pedido) {
    const [escolhido] = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(eq(usuarios.id, pedido));
    if (escolhido) return escolhido;
  }

  return { id: sessao.usuarioId, nome: sessao.nome };
}

export async function carregarMeuDia(
  dia: string,
  supervisorPedido: string | null,
): Promise<DadosMeuDia> {
  const supervisor = await resolverSupervisor(supervisorPedido);

  const demandas = await db
    .select({
      id: demandasExtras.id,
      descricao: demandasExtras.descricao,
      prioridade: demandasExtras.prioridade,
      dataAlvo: demandasExtras.dataAlvo,
      contratoNome: contratos.nome,
      criadaPor: usuarios.nome,
    })
    .from(demandasExtras)
    .leftJoin(contratos, eq(contratos.id, demandasExtras.contratoId))
    .innerJoin(usuarios, eq(usuarios.id, demandasExtras.criadoPor))
    .where(
      and(eq(demandasExtras.supervisorId, supervisor.id), eq(demandasExtras.status, 'aberta')),
    )
    .orderBy(asc(demandasExtras.criadoEm));

  const linhas = await db
    .select({
      id: visitas.id,
      contratoId: visitas.contratoId,
      contratoNome: contratos.nome,
      endereco: contratos.endereco,
      cidade: contratos.cidade,
      uf: contratos.uf,
      periodicidade: contratos.periodicidade,
      observacoes: contratos.observacoes,
      origem: visitas.origem,
      status: visitas.status,
      dataPrevista: visitas.dataPrevista,
      realizadaEm: visitas.realizadaEm,
      motivoDescricao: motivosCancelamento.descricao,
      motivoOutro: visitas.motivoOutro,
      observacao: visitas.observacao,
    })
    .from(visitas)
    .innerJoin(contratos, eq(contratos.id, visitas.contratoId))
    .leftJoin(motivosCancelamento, eq(motivosCancelamento.id, visitas.motivoId))
    .where(and(eq(visitas.supervisorId, supervisor.id), eq(visitas.dataPrevista, dia)))
    .orderBy(asc(contratos.nome));

  const ids = linhas.map((l) => l.id);

  const fotos = ids.length
    ? await db
        .select({
          visitaId: evidencias.visitaId,
          arquivoUrl: evidencias.arquivoUrl,
          latitude: evidencias.latitude,
        })
        .from(evidencias)
        .where(or(...ids.map((id) => eq(evidencias.visitaId, id))))
    : [];

  const contratoIds = [...new Set(linhas.map((l) => l.contratoId))];
  const contatos = contratoIds.length
    ? await db
        .select({
          contratoId: contatosContrato.contratoId,
          nome: contatosContrato.nome,
          cargo: contatosContrato.cargo,
          telefone: contatosContrato.telefone,
          principal: contatosContrato.principal,
        })
        .from(contatosContrato)
        .where(or(...contratoIds.map((id) => eq(contatosContrato.contratoId, id))))
    : [];

  const daCarteira = await db
    .select({ id: contratos.id, nome: contratos.nome })
    .from(carteira)
    .innerJoin(contratos, eq(contratos.id, carteira.contratoId))
    .where(
      and(
        eq(carteira.supervisorId, supervisor.id),
        isNull(carteira.fim),
        eq(contratos.ativo, true),
      ),
    )
    .orderBy(asc(contratos.nome));

  const motivos = await db
    .select({
      id: motivosCancelamento.id,
      descricao: motivosCancelamento.descricao,
      exigeTexto: motivosCancelamento.exigeTexto,
    })
    .from(motivosCancelamento)
    .where(eq(motivosCancelamento.ativo, true))
    .orderBy(asc(motivosCancelamento.ordem));

  return {
    dia,
    supervisorId: supervisor.id,
    supervisorNome: supervisor.nome,
    demandas,
    motivos,
    contratosDaCarteira: daCarteira,
    visitas: linhas.map((l) => {
      const minhas = fotos.filter((f) => f.visitaId === l.id);
      return {
        ...l,
        temLocalizacao: minhas.some((f) => f.latitude !== null),
        fotos: minhas.map((f) => f.arquivoUrl),
        contatos: contatos
          .filter((c) => c.contratoId === l.contratoId)
          .sort((a, b) => Number(b.principal) - Number(a.principal)),
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Registrar visita realizada                                                  */
/* -------------------------------------------------------------------------- */

const numeroOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), 'Coordenada inválida.');

const esquemaRegistro = z.object({
  visitaId: z.string().uuid('Visita inválida.'),
  latitude: numeroOpcional,
  longitude: numeroOpcional,
  precisao: numeroOpcional,
  observacao: z.string().trim().nullable(),
});

export async function registrarRealizada(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');

  const dados = esquemaRegistro.safeParse({
    visitaId: texto(formData.get('visitaId')),
    latitude: texto(formData.get('latitude')),
    longitude: texto(formData.get('longitude')),
    precisao: texto(formData.get('precisao')),
    observacao: textoOuNulo(formData.get('observacao')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const [visita] = await db
    .select()
    .from(visitas)
    .where(eq(visitas.id, dados.data.visitaId));

  if (!visita) return { erro: 'Visita não encontrada.' };
  if (sessao.papel === 'supervisor' && visita.supervisorId !== sessao.usuarioId) {
    return { erro: 'Esta visita não é da sua carteira.' };
  }
  if (visita.status === 'realizada') return { erro: 'Esta visita já foi registrada.' };
  if (visita.status === 'cancelada') return { erro: 'Esta visita foi cancelada.' };

  // Foto é obrigatória: sem ela não há evidência (seção 4.5).
  const arquivos = formData
    .getAll('foto')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (arquivos.length === 0) {
    return { erro: 'Tire ao menos uma foto para registrar a visita.' };
  }

  for (const arquivo of arquivos) {
    if (!tipoAceito(arquivo.type)) {
      return { erro: 'A evidência precisa ser uma foto.' };
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return { erro: 'Foto acima de 15 MB.' };
    }
  }

  // Horário é carimbo do servidor, nunca do aparelho: o relógio do celular é
  // editável e a evidência precisa valer como registro.
  const agora = new Date();
  const guardadas: { chave: string; url: string }[] = [];

  for (const arquivo of arquivos) {
    const chave = novaChave(arquivo.type, agora);
    await guardarEvidencia(chave, new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
    guardadas.push({ chave, url: urlDaEvidencia(chave) });
  }

  const { latitude, longitude, precisao } = dados.data;
  // Sem GPS a visita é registrada assim mesmo e fica marcada como sem
  // localização (seção 4.5): bloquear travaria o supervisor em prédio sem sinal.
  const temCoordenadas = latitude !== null && longitude !== null;

  await db.transaction(async (tx) => {
    await tx
      .update(visitas)
      .set({
        status: 'realizada',
        realizadaEm: agora,
        registradoEm: agora,
        observacao: dados.data.observacao,
      })
      .where(eq(visitas.id, visita.id));

    await tx.insert(evidencias).values(
      guardadas.map((g) => ({
        visitaId: visita.id,
        arquivoUrl: g.url,
        latitude: temCoordenadas ? String(latitude) : null,
        longitude: temCoordenadas ? String(longitude) : null,
        precisaoM: temCoordenadas && precisao !== null ? String(precisao) : null,
        capturadoEm: agora,
      })),
    );
  });

  revalidatePath('/meu-dia');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Cancelar visita                                                             */
/* -------------------------------------------------------------------------- */

const esquemaCancelamento = z.object({
  visitaId: z.string().uuid('Visita inválida.'),
  motivoId: z.string().uuid('Escolha o motivo do cancelamento.'),
  motivoOutro: z.string().trim().nullable(),
});

export async function cancelarVisita(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');

  const dados = esquemaCancelamento.safeParse({
    visitaId: texto(formData.get('visitaId')),
    motivoId: texto(formData.get('motivoId')),
    motivoOutro: textoOuNulo(formData.get('motivoOutro')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const [visita] = await db.select().from(visitas).where(eq(visitas.id, dados.data.visitaId));

  if (!visita) return { erro: 'Visita não encontrada.' };
  // Só o supervisor dono da visita cancela (seção 4.3).
  if (visita.supervisorId !== sessao.usuarioId) {
    return { erro: 'Só o supervisor dono da visita pode cancelá-la.' };
  }
  if (visita.status === 'realizada') {
    return { erro: 'Visita já registrada como realizada não se cancela.' };
  }
  if (visita.status === 'cancelada') return { erro: 'Esta visita já está cancelada.' };

  const [motivo] = await db
    .select()
    .from(motivosCancelamento)
    .where(
      and(eq(motivosCancelamento.id, dados.data.motivoId), eq(motivosCancelamento.ativo, true)),
    );

  if (!motivo) return { erro: 'Motivo inválido.' };

  // "Outro" exige texto livre (seção 4.3, item 12).
  if (motivo.exigeTexto && !dados.data.motivoOutro) {
    return { erro: 'Este motivo exige que você escreva o que houve.' };
  }

  await db
    .update(visitas)
    .set({
      status: 'cancelada',
      motivoId: motivo.id,
      motivoOutro: motivo.exigeTexto ? dados.data.motivoOutro : null,
      registradoEm: new Date(),
    })
    .where(eq(visitas.id, visita.id));

  revalidatePath('/meu-dia');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Visita extra                                                                */
/* -------------------------------------------------------------------------- */

const esquemaExtra = z.object({
  contratoId: z.string().uuid('Escolha o contrato.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  justificativa: z.string().trim().min(1, 'Escreva a justificativa da visita extra.'),
});

export async function lancarVisitaExtra(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('supervisor');

  const dados = esquemaExtra.safeParse({
    contratoId: texto(formData.get('contratoId')),
    data: texto(formData.get('data')),
    justificativa: texto(formData.get('justificativa')),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // A visita extra pode cair em contrato da carteira que não estava programado
  // na semana, mas não em contrato de outra carteira.
  const [vinculo] = await db
    .select({ id: carteira.id })
    .from(carteira)
    .where(
      and(
        eq(carteira.contratoId, dados.data.contratoId),
        eq(carteira.supervisorId, sessao.usuarioId),
        isNull(carteira.fim),
      ),
    );

  if (!vinculo) return { erro: 'Este contrato não está na sua carteira.' };

  const [criada] = await db
    .insert(visitas)
    .values({
      contratoId: dados.data.contratoId,
      supervisorId: sessao.usuarioId,
      dataPrevista: dados.data.data,
      origem: 'extra',
      status: 'prevista',
      observacao: dados.data.justificativa,
    })
    .returning({ id: visitas.id });

  revalidatePath('/meu-dia');
  return { ok: true, campos: { visitaId: criada.id } };
}

/* -------------------------------------------------------------------------- */
/* Demandas extras                                                             */
/* -------------------------------------------------------------------------- */

export async function concluirDemanda(formData: FormData): Promise<void> {
  const sessao = await requireRole('supervisor');
  const id = texto(formData.get('id'));
  if (!id) return;

  const [demanda] = await db
    .select({ supervisorId: demandasExtras.supervisorId })
    .from(demandasExtras)
    .where(eq(demandasExtras.id, id));

  if (!demanda) return;
  if (sessao.papel === 'supervisor' && demanda.supervisorId !== sessao.usuarioId) return;

  await db
    .update(demandasExtras)
    .set({ status: 'concluida' })
    .where(and(eq(demandasExtras.id, id), ne(demandasExtras.status, 'concluida')));

  revalidatePath('/meu-dia');
}

const esquemaDemanda = z.object({
  supervisorId: z.string().uuid('Escolha o supervisor.'),
  descricao: z.string().trim().min(1, 'Descreva a demanda.'),
  contratoId: z.union([z.string().uuid(), z.null()]),
  dataAlvo: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  prioridade: z.enum(['normal', 'alta', 'urgente']),
});

/**
 * Demanda extra da coordenação (seção 4.6). Com contrato e data, cria junto a
 * visita correspondente, com origem 'demanda_coordenacao'.
 */
export async function criarDemanda(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await requireRole('coordenador');

  const dados = esquemaDemanda.safeParse({
    supervisorId: texto(formData.get('supervisorId')),
    descricao: texto(formData.get('descricao')),
    contratoId: textoOuNulo(formData.get('contratoId')),
    dataAlvo: textoOuNulo(formData.get('dataAlvo')),
    prioridade: texto(formData.get('prioridade')) || 'normal',
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const { supervisorId, contratoId, dataAlvo } = dados.data;

  const [supervisor] = await db
    .select({ ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, supervisorId));

  if (!supervisor) return { erro: 'Supervisor não encontrado.' };
  if (!supervisor.ativo) return { erro: 'Supervisor inativo não recebe demanda.' };

  // Com contrato, ele precisa estar na carteira vigente de quem vai atender.
  if (contratoId) {
    const [vinculo] = await db
      .select({ id: carteira.id })
      .from(carteira)
      .where(
        and(
          eq(carteira.contratoId, contratoId),
          eq(carteira.supervisorId, supervisorId),
          isNull(carteira.fim),
        ),
      );

    if (!vinculo) return { erro: 'Este contrato não está na carteira deste supervisor.' };
  }

  await db.transaction(async (tx) => {
    const [demanda] = await tx
      .insert(demandasExtras)
      .values({
        criadoPor: sessao.usuarioId,
        supervisorId,
        contratoId,
        descricao: dados.data.descricao,
        dataAlvo,
        prioridade: dados.data.prioridade,
      })
      .returning({ id: demandasExtras.id });

    if (contratoId && dataAlvo) {
      await tx.insert(visitas).values({
        contratoId,
        supervisorId,
        dataPrevista: dataAlvo,
        origem: 'demanda_coordenacao',
        status: 'prevista',
        demandaId: demanda.id,
      });
    }
  });

  revalidatePath('/meu-dia');
  return { ok: true };
}

export async function supervisoresAtivos() {
  await requireRole('coordenador');

  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));
}

/** Marca a demanda como lida ao abrir o Meu dia, para o painel medir o tempo. */
export async function marcarDemandasLidas(supervisorId: string): Promise<void> {
  await db
    .update(demandasExtras)
    .set({ lidaEm: new Date() })
    .where(
      and(
        eq(demandasExtras.supervisorId, supervisorId),
        eq(demandasExtras.status, 'aberta'),
        isNull(demandasExtras.lidaEm),
      ),
    );
}
