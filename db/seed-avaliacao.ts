import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  avaliacaoCompetencias,
  avaliacaoCriterios,
  avaliacaoModelos,
} from './schema';

/**
 * Modelo REV 00 da avaliação trimestral (seção 9.1).
 *
 * Nota sobre o escopo: a seção 9 diz "22 critérios", mas a tabela de
 * competências soma 21 (4+4+4+3+3+3). Seguimos a tabela, que é a parte
 * específica. O modelo é versionado: incluir o 22º critério é criar a REV 01,
 * sem tocar nas avaliações já feitas.
 *
 * Dos critérios, o escopo nomeia três (1.1, 2.3 e 5.1). Os demais foram
 * redigidos aqui e podem ser reescritos numa nova versão do modelo.
 */
const MODELO = {
  nome: 'Avaliação Trimestral de Supervisores',
  versao: 'REV 00',
  competencias: [
    {
      ordem: 1,
      nome: 'Operação e cumprimento de rotas',
      peso: '0.250',
      criterios: [
        { codigo: '1.1', descricao: 'Cumprimento do roteiro de visitas', indicadorAuto: 'aderencia_visitas' },
        { codigo: '1.2', descricao: 'Pontualidade nas visitas programadas', indicadorAuto: null },
        { codigo: '1.3', descricao: 'Registro das visitas com evidência', indicadorAuto: null },
        { codigo: '1.4', descricao: 'Tratamento de cancelamentos e remarcações', indicadorAuto: null },
      ],
    },
    {
      ordem: 2,
      nome: 'Documentação e compliance',
      peso: '0.200',
      criterios: [
        { codigo: '2.1', descricao: 'Qualidade dos registros e relatórios', indicadorAuto: null },
        { codigo: '2.2', descricao: 'Organização da documentação do contrato', indicadorAuto: null },
        { codigo: '2.3', descricao: 'Obrigações mensais no prazo', indicadorAuto: 'cumprimento_prazos' },
        { codigo: '2.4', descricao: 'Conformidade com os procedimentos do SGI', indicadorAuto: null },
      ],
    },
    {
      ordem: 3,
      nome: 'Gestão de equipe',
      peso: '0.200',
      criterios: [
        { codigo: '3.1', descricao: 'Cobertura de faltas e substituições', indicadorAuto: null },
        { codigo: '3.2', descricao: 'Acompanhamento e orientação da equipe', indicadorAuto: null },
        { codigo: '3.3', descricao: 'Controle de frequência e escala', indicadorAuto: null },
        { codigo: '3.4', descricao: 'Clima e retenção da equipe', indicadorAuto: null },
      ],
    },
    {
      ordem: 4,
      nome: 'Relacionamento com o cliente',
      peso: '0.150',
      criterios: [
        { codigo: '4.1', descricao: 'Comunicação com o contato do contrato', indicadorAuto: null },
        { codigo: '4.2', descricao: 'Resposta a solicitações e reclamações', indicadorAuto: null },
        { codigo: '4.3', descricao: 'Percepção do cliente sobre o serviço', indicadorAuto: null },
      ],
    },
    {
      ordem: 5,
      nome: 'Controle de materiais e patrimônio',
      peso: '0.100',
      criterios: [
        { codigo: '5.1', descricao: 'Aderência ao orçamento de materiais', indicadorAuto: null },
        { codigo: '5.2', descricao: 'Controle de uniformes e EPIs', indicadorAuto: null },
        { codigo: '5.3', descricao: 'Conservação de equipamentos e patrimônio', indicadorAuto: null },
      ],
    },
    {
      ordem: 6,
      nome: 'Postura profissional e segurança',
      peso: '0.100',
      criterios: [
        { codigo: '6.1', descricao: 'Apresentação e postura profissional', indicadorAuto: null },
        { codigo: '6.2', descricao: 'Cumprimento das normas de segurança', indicadorAuto: null },
        { codigo: '6.3', descricao: 'Iniciativa e resolução de problemas', indicadorAuto: null },
      ],
    },
  ],
} as const;

export async function semearModeloAvaliacao(
  db: ReturnType<typeof drizzle>,
): Promise<boolean> {
  const [existe] = await db
    .select({ id: avaliacaoModelos.id })
    .from(avaliacaoModelos)
    .where(eq(avaliacaoModelos.versao, MODELO.versao));

  if (existe) return false;

  const soma = MODELO.competencias.reduce((s, c) => s + Number(c.peso), 0);
  if (Math.abs(soma - 1) > 0.0005) {
    throw new Error(`Os pesos do modelo somam ${soma}, e precisam somar 1.`);
  }

  const [modelo] = await db
    .insert(avaliacaoModelos)
    .values({ nome: MODELO.nome, versao: MODELO.versao, vigente: true })
    .returning({ id: avaliacaoModelos.id });

  for (const c of MODELO.competencias) {
    const [competencia] = await db
      .insert(avaliacaoCompetencias)
      .values({ modeloId: modelo.id, ordem: c.ordem, nome: c.nome, peso: c.peso })
      .returning({ id: avaliacaoCompetencias.id });

    await db.insert(avaliacaoCriterios).values(
      c.criterios.map((k, i) => ({
        competenciaId: competencia.id,
        codigo: k.codigo,
        descricao: k.descricao,
        indicadorAuto: k.indicadorAuto,
        ordem: i + 1,
      })),
    );
  }

  return true;
}

async function main() {
  const cliente = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const db = drizzle(cliente);
  try {
    const criado = await semearModeloAvaliacao(db);
    console.log(criado ? 'Modelo REV 00 criado.' : 'Modelo REV 00 já existe — nada a fazer.');
  } finally {
    await cliente.end();
  }
}

if (process.argv[1]?.endsWith('seed-avaliacao.ts')) main();
