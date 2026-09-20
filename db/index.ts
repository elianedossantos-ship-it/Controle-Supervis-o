import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
}

/**
 * O tamanho do pool depende de onde o sistema roda:
 *
 * - servidor único (VPS, container): um pool de 10 é saudável.
 * - serverless (Vercel, Lambda): cada instância abre o próprio pool, então
 *   `DB_POOL_MAX=1` com uma URL de pooler (pgBouncer do Neon ou do Supabase).
 *
 * O pooler em modo transação não guarda prepared statements entre comandos, e
 * o driver precisa saber disso — daí `DB_PREPARE=false`. Sem isso o segundo
 * comando de uma requisição falha com "prepared statement does not exist".
 */
const maximoDeConexoes = Number(process.env.DB_POOL_MAX ?? 10);
const usaPrepared = process.env.DB_PREPARE !== 'false';

/**
 * Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem o cache
 * global, cada recarga abriria um novo pool e o Postgres esgotaria as conexões.
 */
const globalParaPg = globalThis as unknown as {
  conexaoPg?: ReturnType<typeof postgres>;
};

const cliente =
  globalParaPg.conexaoPg ??
  postgres(process.env.DATABASE_URL, {
    max: Number.isFinite(maximoDeConexoes) && maximoDeConexoes > 0 ? maximoDeConexoes : 10,
    prepare: usaPrepared,
  });

if (process.env.NODE_ENV !== 'production') {
  globalParaPg.conexaoPg = cliente;
}

export const db = drizzle(cliente, { schema });
export { schema };
