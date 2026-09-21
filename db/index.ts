import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
}

/**
 * O jeito certo de abrir o pool depende de onde o sistema roda, e a própria
 * URL diz isso: uma URL de pooler (pgBouncer do Supabase ou do Neon) atende
 * serverless, onde cada instância abriria o próprio pool e esgotaria o banco.
 * Nesse caso é uma conexão por instância, e sem prepared statements — o pooler
 * em modo transação não os guarda entre comandos, e o segundo comando de cada
 * requisição falharia com "prepared statement does not exist".
 *
 * Deduzir evita a configuração errada e silenciosa. `DB_POOL_MAX` e
 * `DB_PREPARE` continuam existindo para quem precisar contrariar a dedução.
 */
function ehPooler(url: string): boolean {
  return /pooler\.|pgbouncer|:6543\//.test(url);
}

const pooler = ehPooler(process.env.DATABASE_URL);
const maximoDeConexoes = Number(process.env.DB_POOL_MAX ?? (pooler ? 1 : 10));
const usaPrepared = (process.env.DB_PREPARE ?? String(!pooler)) !== 'false';

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
