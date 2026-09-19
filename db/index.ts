import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
}

/**
 * Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem o cache
 * global, cada recarga abriria um novo pool e o Postgres esgotaria as conexões.
 */
const globalParaPg = globalThis as unknown as {
  conexaoPg?: ReturnType<typeof postgres>;
};

const cliente =
  globalParaPg.conexaoPg ?? postgres(process.env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV !== 'production') {
  globalParaPg.conexaoPg = cliente;
}

export const db = drizzle(cliente, { schema });
export { schema };
