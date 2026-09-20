import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Caminhos relativos a esta pasta — a suíte roda de qualquer lugar. */
const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (p) => resolve(AQUI, p);

/** Porta e navegador vêm do ambiente, com o padrão do desenvolvimento. */
const PORTA = process.env.E2E_PORTA ?? '3000';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';


const B = `http://localhost:${PORTA}`;

/*
 * Esta suíte mede só a autorização por papel, então semeia as próprias contas
 * em vez de depender do que outra suíte deixou. Os hashes são bcrypt de
 * 'aline123', 'carla123' e 'inativo123', gerados uma vez.
 *
 * A semeadura vai por arquivo .sql: o hash bcrypt tem cifrões, e o shell os
 * comeria num psql -c entre aspas — foi exatamente o que aconteceu antes.
 */
const SQL = resolve(tmpdir(), 'papeis-semente.sql');
writeFileSync(SQL, `
insert into usuarios (nome, email, senha_hash, papel, ativo) values
 ('Aline Teste','aline@teste.com','$2b$12$BYkkupk0YhClTvz0kW5Ln.gJtuGdW./.rBqDGQCwOC6nHqc1Ms5u.','supervisor',true),
 ('Carla Teste','carla@teste.com','$2b$12$J76kObR5If0eGu.5671IBuwdYifOULx8ZnVnJ/aVtuMNxS3nf/k36','coordenador',true),
 ('Inativo Teste','inativo@teste.com','$2b$12$cegKaSSkQ.ZPiikmUkIZsORUWAoQ1Fc.ZQzkfO0F7f0Ky/joEDoV.','supervisor',false)
on conflict (email) do update set senha_hash = excluded.senha_hash, ativo = excluded.ativo;
`);
execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -f ${SQL}`, { encoding: 'utf8' });

const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function entrar(email, senha) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', senha);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const PROTEGIDAS_COORD = ['/painel', '/exportar',
  '/cadastros/supervisores', '/cadastros/contratos', '/cadastros/carteira', '/cadastros/feriados'];
// /avaliacoes é do supervisor também: decisão 13.12, ele vê as próprias.
const DO_SUPERVISOR = ['/meu-dia', '/programacao', '/prazos', '/planos', '/avaliacoes'];

console.log('\n########## SUPERVISOR ##########');
{
  const { ctx, page } = await entrar('aline@teste.com', 'aline123');
  ok(new URL(page.url()).pathname === '/meu-dia', `tela inicial do supervisor: ${new URL(page.url()).pathname}`);

  console.log('\n-- telas de coordenação devem barrar --');
  for (const rota of PROTEGIDAS_COORD) {
    await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
    const destino = new URL(page.url()).pathname;
    ok(destino === '/sem-acesso', `${rota} -> ${destino}`);
  }

  console.log('\n-- telas do supervisor devem abrir --');
  for (const rota of DO_SUPERVISOR) {
    await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === rota, `${rota} abriu`);
  }

  console.log('\n-- navegação não oferece o que ele não pode --');
  await page.goto(`${B}/meu-dia`, { waitUntil: 'networkidle' });
  const itens = [...new Set(await page.locator('nav a').allTextContents())];
  console.log(`  itens: ${JSON.stringify(itens)}`);
  ok(!itens.includes('Painel'), 'sem "Painel" no menu');
  ok(!itens.includes('Contratos'), 'sem "Contratos" no menu');
  ok(!itens.includes('Exportar REG-061'), 'sem "Exportar REG-061" no menu');
  ok(itens.includes('Meu dia') && itens.includes('Prazos'), 'mantém "Meu dia" e "Prazos"');
  await ctx.close();
}

console.log('\n########## COORDENADOR ##########');
{
  const { ctx, page } = await entrar('carla@teste.com', 'carla123');
  ok(new URL(page.url()).pathname === '/painel', `tela inicial: ${new URL(page.url()).pathname}`);
  for (const rota of [...PROTEGIDAS_COORD, ...DO_SUPERVISOR]) {
    await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === rota, `${rota} abriu (coordenador faz tudo do supervisor)`);
  }
  await ctx.close();
}

console.log('\n########## USUÁRIO INATIVO ##########');
{
  const { ctx, page } = await entrar('inativo@teste.com', 'inativo123');
  ok(new URL(page.url()).pathname === '/login', `barrado no login: ${new URL(page.url()).pathname}`);
  ok(!(await ctx.cookies()).some((c) => c.name === 'sessao'), 'nenhuma sessão aberta para usuário inativo');
  const msg = await page.locator('[data-slot=alert]').textContent().catch(() => '');
  ok(msg.includes('E-mail ou senha inválidos'), `mensagem genérica (não revela que a conta existe): ${JSON.stringify(msg)}`);
  await ctx.close();
}

console.log('\n########## COOKIE ADULTERADO ##########');
{
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: 'sessao', value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIiwicGFwZWwiOiJhZG1pbiJ9.assinatura-falsa', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await page.goto(`${B}/painel`, { waitUntil: 'networkidle' });
  ok(new URL(page.url()).pathname === '/login', `token forjado rejeitado -> ${new URL(page.url()).pathname}`);
  await ctx.close();
}

await browser.close();
