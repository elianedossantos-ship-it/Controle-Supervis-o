import {
  boolean,
  check,
  char,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* -------------------------------------------------------------------------- */
/* Usuários                                                                    */
/* -------------------------------------------------------------------------- */

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    nome: text('nome').notNull(),
    email: text('email').notNull().unique(),
    telefone: text('telefone'),
    whatsapp: text('whatsapp'),
    senhaHash: text('senha_hash').notNull(),
    papel: text('papel').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('usuarios_papel_check', sql`${t.papel} IN ('supervisor','coordenador','admin')`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Contratos e contatos                                                        */
/* -------------------------------------------------------------------------- */

export const contratos = pgTable(
  'contratos',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    nome: text('nome').notNull(),
    endereco: text('endereco').notNull(),
    bairro: text('bairro'),
    cidade: text('cidade'),
    uf: char('uf', { length: 2 }),
    periodicidade: text('periodicidade').notNull(),
    // limpeza, bombeiros, manutencao, recepcao...
    escopo: text('escopo').array(),
    // ex.: 'inclui a manutenção', 'brigada em outro andar'
    observacoes: text('observacoes'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'contratos_periodicidade_check',
      sql`${t.periodicidade} IN ('SEMANAL','2X NA SEMANA','QUINZENAL','MENSAL')`,
    ),
  ],
);

export const contatosContrato = pgTable('contatos_contrato', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contratoId: uuid('contrato_id')
    .notNull()
    .references(() => contratos.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  cargo: text('cargo'),
  telefone: text('telefone'),
  email: text('email'),
  principal: boolean('principal').notNull().default(false),
});

/* -------------------------------------------------------------------------- */
/* Carteira: 1 contrato -> 1 supervisor vigente, com histórico                 */
/* -------------------------------------------------------------------------- */

export const carteira = pgTable(
  'carteira',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    contratoId: uuid('contrato_id')
      .notNull()
      .references(() => contratos.id),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    inicio: date('inicio').notNull(),
    // NULL = vigente
    fim: date('fim'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Garante 1 supervisor vigente por contrato
    uniqueIndex('carteira_vigente_unica')
      .on(t.contratoId)
      .where(sql`${t.fim} IS NULL`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Programação semanal (cabeçalho da semana por supervisor)                    */
/* -------------------------------------------------------------------------- */

export const programacoes = pgTable(
  'programacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    // sempre uma segunda-feira
    semanaInicio: date('semana_inicio').notNull(),
    // sexta-feira correspondente
    semanaFim: date('semana_fim').notNull(),
    status: text('status').notNull().default('rascunho'),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('programacoes_status_check', sql`${t.status} IN ('rascunho','enviada')`),
    uniqueIndex('programacoes_supervisor_semana_unica').on(t.supervisorId, t.semanaInicio),
  ],
);

/* -------------------------------------------------------------------------- */
/* Motivos de cancelamento (lista fechada, seção 4.3)                          */
/* -------------------------------------------------------------------------- */

export const motivosCancelamento = pgTable('motivos_cancelamento', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  descricao: text('descricao').notNull(),
  // logistica | administrativo | cliente | outro
  categoria: text('categoria'),
  exigeTexto: boolean('exige_texto').notNull().default(false),
  ordem: integer('ordem'),
  ativo: boolean('ativo').notNull().default(true),
});

/* -------------------------------------------------------------------------- */
/* Demandas extras criadas pela coordenação                                    */
/* -------------------------------------------------------------------------- */

export const demandasExtras = pgTable(
  'demandas_extras',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => usuarios.id),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    contratoId: uuid('contrato_id').references(() => contratos.id),
    descricao: text('descricao').notNull(),
    dataAlvo: date('data_alvo'),
    prioridade: text('prioridade'),
    status: text('status').notNull().default('aberta'),
    lidaEm: timestamp('lida_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'demandas_extras_prioridade_check',
      sql`${t.prioridade} IN ('normal','alta','urgente')`,
    ),
    check(
      'demandas_extras_status_check',
      sql`${t.status} IN ('aberta','concluida','cancelada')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Visitas (o dado primário do sistema)                                        */
/* -------------------------------------------------------------------------- */

export const visitas = pgTable(
  'visitas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // NULL em visita extra fora da semana
    programacaoId: uuid('programacao_id').references(() => programacoes.id),
    contratoId: uuid('contrato_id')
      .notNull()
      .references(() => contratos.id),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    dataPrevista: date('data_prevista').notNull(),
    origem: text('origem').notNull().default('programada'),
    demandaId: uuid('demanda_id').references(() => demandasExtras.id),
    status: text('status').notNull().default('prevista'),
    realizadaEm: timestamp('realizada_em', { withTimezone: true }),
    motivoId: uuid('motivo_id').references(() => motivosCancelamento.id),
    // preenchido quando o motivo for 'Outro'
    motivoOutro: text('motivo_outro'),
    observacao: text('observacao'),
    registradoEm: timestamp('registrado_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'visitas_origem_check',
      sql`${t.origem} IN ('programada','extra','demanda_coordenacao')`,
    ),
    check(
      'visitas_status_check',
      sql`${t.status} IN ('prevista','realizada','cancelada')`,
    ),
    index('visitas_por_data').on(t.dataPrevista),
    index('visitas_por_supervisor').on(t.supervisorId, t.dataPrevista),
  ],
);

/* -------------------------------------------------------------------------- */
/* Planos de ação por contrato (seção 10)                                      */
/* -------------------------------------------------------------------------- */

export const planosAcao = pgTable(
  'planos_acao',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    contratoId: uuid('contrato_id')
      .notNull()
      .references(() => contratos.id),
    // visita em que nasceu
    visitaOrigemId: uuid('visita_origem_id').references(() => visitas.id),
    abertoPor: uuid('aberto_por')
      .notNull()
      .references(() => usuarios.id),
    descricao: text('descricao').notNull(),
    localSetor: text('local_setor'),
    prioridade: text('prioridade').notNull().default('normal'),
    prazo: date('prazo'),
    responsavel: text('responsavel'),
    status: text('status').notNull().default('aberto'),
    resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
    resolvidoPor: uuid('resolvido_por').references(() => usuarios.id),
    motivoCancelamento: text('motivo_cancelamento'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'planos_acao_prioridade_check',
      sql`${t.prioridade} IN ('baixa','normal','alta','critica')`,
    ),
    check(
      'planos_acao_status_check',
      sql`${t.status} IN ('aberto','em_andamento','resolvido','cancelado')`,
    ),
    index('planos_abertos_por_contrato')
      .on(t.contratoId)
      .where(sql`${t.status} IN ('aberto','em_andamento')`),
  ],
);

/* Histórico somente-acréscimo */
export const planoAtualizacoes = pgTable(
  'plano_atualizacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    planoId: uuid('plano_id')
      .notNull()
      .references(() => planosAcao.id, { onDelete: 'cascade' }),
    // visita em que foi atualizado
    visitaId: uuid('visita_id').references(() => visitas.id),
    autorId: uuid('autor_id')
      .notNull()
      .references(() => usuarios.id),
    tipo: text('tipo').notNull(),
    texto: text('texto'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'plano_atualizacoes_tipo_check',
      sql`${t.tipo} IN ('acompanhamento','edicao','resolucao','reabertura','cancelamento')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Evidências: servem a visita, plano de ação e atualização de plano           */
/* -------------------------------------------------------------------------- */

export const evidencias = pgTable(
  'evidencias',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    visitaId: uuid('visita_id').references(() => visitas.id, { onDelete: 'cascade' }),
    planoId: uuid('plano_id').references(() => planosAcao.id),
    atualizacaoId: uuid('atualizacao_id').references(() => planoAtualizacoes.id),
    arquivoUrl: text('arquivo_url').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    precisaoM: numeric('precisao_m', { precision: 6, scale: 1 }),
    capturadoEm: timestamp('capturado_em', { withTimezone: true }).notNull(),
  },
  (t) => [
    check(
      'evidencia_tem_dono',
      sql`${t.visitaId} IS NOT NULL OR ${t.planoId} IS NOT NULL OR ${t.atualizacaoId} IS NOT NULL`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Feriados (alimenta a marcação F)                                            */
/* -------------------------------------------------------------------------- */

export const feriados = pgTable(
  'feriados',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    data: date('data').notNull(),
    descricao: text('descricao').notNull(),
    abrangencia: text('abrangencia').notNull(),
    uf: char('uf', { length: 2 }),
    municipio: text('municipio'),
  },
  (t) => [
    check(
      'feriados_abrangencia_check',
      sql`${t.abrangencia} IN ('nacional','estadual','municipal')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Prazos e obrigações (seção 8)                                               */
/* -------------------------------------------------------------------------- */

export const obrigacoes = pgTable(
  'obrigacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    nome: text('nome').notNull(),
    recorrencia: text('recorrencia').notNull(),
    // mensal: 1, 7, 8, 10
    diaLimite: integer('dia_limite'),
    // semanal: 5 = sexta
    diaSemana: integer('dia_semana'),
    escopo: text('escopo').notNull().default('supervisor'),
    automatica: boolean('automatica').notNull().default(false),
    ordem: integer('ordem'),
    ativo: boolean('ativo').notNull().default(true),
  },
  (t) => [
    check(
      'obrigacoes_recorrencia_check',
      sql`${t.recorrencia} IN ('mensal','semanal','diaria')`,
    ),
    check('obrigacoes_escopo_check', sql`${t.escopo} IN ('supervisor','contrato')`),
  ],
);

/* Uma linha por obrigação x supervisor x competência */
export const obrigacaoOcorrencias = pgTable(
  'obrigacao_ocorrencias',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    obrigacaoId: uuid('obrigacao_id')
      .notNull()
      .references(() => obrigacoes.id),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    // só quando escopo = 'contrato'
    contratoId: uuid('contrato_id').references(() => contratos.id),
    // 1º dia do mês, ou a segunda da semana
    competencia: date('competencia').notNull(),
    prazo: date('prazo').notNull(),
    status: text('status').notNull().default('pendente'),
    dataEntrega: date('data_entrega'),
    // só na obrigação diária
    diasAtendidos: integer('dias_atendidos'),
    diasUteis: integer('dias_uteis'),
    observacao: text('observacao'),
    marcadoPor: uuid('marcado_por').references(() => usuarios.id),
    marcadoEm: timestamp('marcado_em', { withTimezone: true }),
  },
  (t) => [
    check(
      'obrigacao_ocorrencias_status_check',
      sql`${t.status} IN ('pendente','atendido','atendido_atraso','nao_atendido','nao_aplicavel')`,
    ),
    uniqueIndex('obrigacao_ocorrencias_unica').on(
      t.obrigacaoId,
      t.supervisorId,
      t.contratoId,
      t.competencia,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Avaliação trimestral de desempenho (seção 9)                                */
/* -------------------------------------------------------------------------- */

export const avaliacaoModelos = pgTable('avaliacao_modelos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // 'Avaliação Trimestral de Supervisores'
  nome: text('nome').notNull(),
  // 'REV 00'
  versao: text('versao').notNull(),
  vigente: boolean('vigente').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const avaliacaoCompetencias = pgTable('avaliacao_competencias', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  modeloId: uuid('modelo_id')
    .notNull()
    .references(() => avaliacaoModelos.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  nome: text('nome').notNull(),
  // 0.250, 0.200...
  peso: numeric('peso', { precision: 4, scale: 3 }).notNull(),
});

export const avaliacaoCriterios = pgTable('avaliacao_criterios', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  competenciaId: uuid('competencia_id')
    .notNull()
    .references(() => avaliacaoCompetencias.id, { onDelete: 'cascade' }),
  // '1.1', '2.3'
  codigo: text('codigo').notNull(),
  descricao: text('descricao').notNull(),
  // 'aderencia_visitas' | 'cumprimento_prazos' | NULL
  indicadorAuto: text('indicador_auto'),
  ordem: integer('ordem').notNull(),
});

/* Uma avaliação = supervisor x trimestre */
export const avaliacoes = pgTable(
  'avaliacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    modeloId: uuid('modelo_id')
      .notNull()
      .references(() => avaliacaoModelos.id),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => usuarios.id),
    avaliadorId: uuid('avaliador_id')
      .notNull()
      .references(() => usuarios.id),
    periodoInicio: date('periodo_inicio').notNull(),
    periodoFim: date('periodo_fim').notNull(),
    dataAvaliacao: date('data_avaliacao'),
    // calculada na finalização
    notaFinal: numeric('nota_final', { precision: 4, scale: 2 }),
    aproveitamento: numeric('aproveitamento', { precision: 5, scale: 2 }),
    classificacao: text('classificacao'),
    pontosFortes: text('pontos_fortes'),
    pontosAtencao: text('pontos_atencao'),
    status: text('status').notNull().default('rascunho'),
    finalizadaEm: timestamp('finalizada_em', { withTimezone: true }),
  },
  (t) => [
    check(
      'avaliacoes_status_check',
      sql`${t.status} IN ('rascunho','finalizada','assinada')`,
    ),
    uniqueIndex('avaliacoes_supervisor_periodo_unica').on(t.supervisorId, t.periodoInicio),
  ],
);

export const avaliacaoNotas = pgTable(
  'avaliacao_notas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    avaliacaoId: uuid('avaliacao_id')
      .notNull()
      .references(() => avaliacoes.id, { onDelete: 'cascade' }),
    criterioId: uuid('criterio_id')
      .notNull()
      .references(() => avaliacaoCriterios.id),
    // NULL = não se aplica
    nota: integer('nota'),
    comentario: text('comentario'),
  },
  (t) => [
    check('avaliacao_notas_nota_check', sql`${t.nota} BETWEEN 1 AND 5`),
    uniqueIndex('avaliacao_notas_unica').on(t.avaliacaoId, t.criterioId),
  ],
);

/* PDI: ações acordadas */
export const avaliacaoAcoes = pgTable(
  'avaliacao_acoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    avaliacaoId: uuid('avaliacao_id')
      .notNull()
      .references(() => avaliacoes.id, { onDelete: 'cascade' }),
    ordem: integer('ordem'),
    acao: text('acao').notNull(),
    como: text('como'),
    responsavel: text('responsavel'),
    prazo: date('prazo'),
    status: text('status').notNull().default('aberta'),
  },
  (t) => [
    check(
      'avaliacao_acoes_status_check',
      sql`${t.status} IN ('aberta','concluida','cancelada')`,
    ),
  ],
);
