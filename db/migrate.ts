import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }

  // max: 1 — o migrator precisa rodar as migrations em série, numa só conexão.
  const cliente = postgres(process.env.DATABASE_URL, { max: 1 });

  try {
    await migrate(drizzle(cliente), { migrationsFolder: './db/migrations' });
    console.log('Migrations aplicadas.');
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error('Falha ao aplicar as migrations:', erro);
  process.exit(1);
});
