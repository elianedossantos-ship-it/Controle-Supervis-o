import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashSenha } from '../lib/senha';
import { motivosCancelamento, obrigacoes, usuarios } from './schema';

/**
 * Lista fechada da seção 4.3 do escopo. Fica em tabela, e não em código, para a
 * coordenação incluir ou aposentar itens sem depender de deploy — o seed só
 * garante a carga inicial.
 */
const MOTIVOS = [
  {
    ordem: 1,
    descricao: 'Entrega de benefícios em outro contrato não previsto na rota',
    categoria: 'logistica',
  },
  {
    ordem: 2,
    descricao: 'Entrega de uniformes em outro contrato não previsto na rota',
    categoria: 'logistica',
  },
  {
    ordem: 3,
    descricao: 'Demanda administrativa — prévia de pagamento',
    categoria: 'administrativo',
  },
  {
    ordem: 4,
    descricao:
      'Demanda administrativa — atualização de mapa de frequência / RPA / solicitação de uniforme',
    categoria: 'administrativo',
  },
  {
    ordem: 5,
    descricao: 'Demanda administrativa — atualização Flit',
    categoria: 'administrativo',
  },
  {
    ordem: 6,
    descricao: 'Demanda administrativa — erros de pagamento / benefícios',
    categoria: 'administrativo',
  },
  {
    ordem: 7,
    descricao: 'Demanda administrativa — plano de trabalho',
    categoria: 'administrativo',
  },
  { ordem: 8, descricao: 'Veículo em manutenção', categoria: 'logistica' },
  { ordem: 9, descricao: 'Remarcado pelo cliente', categoria: 'cliente' },
  { ordem: 10, descricao: 'Reunião com a Coordenação', categoria: 'administrativo' },
  { ordem: 11, descricao: 'Trânsito / deslocamento', categoria: 'logistica' },
  {
    ordem: 12,
    descricao: 'Outro',
    categoria: 'outro',
    exigeTexto: true,
  },
] as const;

/**
 * Catálogo inicial da seção 8.1. Fica em tabela, e não em código: a coordenação
 * inclui, altera prazo, muda o escopo ou aposenta uma obrigação pela tela, sem
 * depender de deploy. O seed só garante a carga inicial.
 *
 * Escopo: todas entram como 'supervisor' (uma marcação por mês, não uma por
 * unidade). É o padrão de menor volume e reversível pela tela — a decisão 13.8
 * segue com a coordenação.
 */
const OBRIGACOES = [
  { ordem: 1, nome: 'Lançamento das medições', recorrencia: 'mensal', diaLimite: 1, diaSemana: null, automatica: false },
  { ordem: 2, nome: 'Entrega de folha de ponto', recorrencia: 'mensal', diaLimite: 7, diaSemana: null, automatica: false },
  { ordem: 3, nome: 'Solicitações de férias', recorrencia: 'mensal', diaLimite: 8, diaSemana: null, automatica: false },
  { ordem: 4, nome: 'Solicitação de material', recorrencia: 'mensal', diaLimite: 10, diaSemana: null, automatica: false },
  // Automática: o sistema sabe se a programação da semana seguinte foi enviada.
  { ordem: 5, nome: 'Cronograma de visitas', recorrencia: 'semanal', diaLimite: null, diaSemana: 5, automatica: true },
  // Diária consolidada no mês: "dias atendidos ÷ dias úteis" (decisão 13.9).
  { ordem: 6, nome: 'Mapa de frequência atualizado', recorrencia: 'diaria', diaLimite: null, diaSemana: null, automatica: false },
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }

  const cliente = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(cliente);

  try {
    // Motivos de cancelamento --------------------------------------------------
    const jaCadastrados = await db
      .select({ descricao: motivosCancelamento.descricao })
      .from(motivosCancelamento);
    const existentes = new Set(jaCadastrados.map((m) => m.descricao));

    const novos = MOTIVOS.filter((m) => !existentes.has(m.descricao)).map((m) => ({
      descricao: m.descricao,
      categoria: m.categoria,
      ordem: m.ordem,
      exigeTexto: 'exigeTexto' in m ? m.exigeTexto : false,
    }));

    if (novos.length > 0) {
      await db.insert(motivosCancelamento).values(novos);
      console.log(`Motivos de cancelamento inseridos: ${novos.length}`);
    } else {
      console.log('Motivos de cancelamento já cadastrados — nada a fazer.');
    }

    // Catálogo de obrigações ---------------------------------------------------
    const obrigacoesExistentes = await db
      .select({ nome: obrigacoes.nome })
      .from(obrigacoes);
    const nomesObrigacoes = new Set(obrigacoesExistentes.map((o) => o.nome));

    const novasObrigacoes = OBRIGACOES.filter((o) => !nomesObrigacoes.has(o.nome)).map(
      (o) => ({
        nome: o.nome,
        recorrencia: o.recorrencia,
        diaLimite: o.diaLimite,
        diaSemana: o.diaSemana,
        escopo: 'supervisor',
        automatica: o.automatica,
        ordem: o.ordem,
      }),
    );

    if (novasObrigacoes.length > 0) {
      await db.insert(obrigacoes).values(novasObrigacoes);
      console.log(`Obrigações inseridas: ${novasObrigacoes.length}`);
    } else {
      console.log('Obrigações já cadastradas — nada a fazer.');
    }

    // Usuário admin ------------------------------------------------------------
    const nome = process.env.SEED_ADMIN_NOME ?? 'Administrador';
    const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@empresa.com.br').toLowerCase();
    const senha = process.env.SEED_ADMIN_SENHA;

    if (!senha) {
      throw new Error(
        'SEED_ADMIN_SENHA não definida. Defina no .env antes de rodar o seed.',
      );
    }

    const [admin] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, email));

    if (admin) {
      console.log(`Admin ${email} já existe — senha preservada.`);
    } else {
      await db.insert(usuarios).values({
        nome,
        email,
        senhaHash: await hashSenha(senha),
        papel: 'admin',
      });
      console.log(`Admin criado: ${email}`);
    }
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error('Falha no seed:', erro);
  process.exit(1);
});
