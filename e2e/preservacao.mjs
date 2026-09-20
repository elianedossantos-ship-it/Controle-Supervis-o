import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Caminhos relativos a esta pasta — a suíte roda de qualquer lugar. */
const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (p) => resolve(AQUI, p);

/** Porta e navegador vêm do ambiente, com o padrão do desenvolvimento. */
const PORTA = process.env.E2E_PORTA ?? '3000';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';


const B = `http://localhost:${PORTA}`;
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

// Estado montado do zero, sem depender de execução anterior.
exec("delete from visitas; delete from programacoes;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");
const clinica = sql("select id from contratos where nome='Clínica Vida Plena'");
const logistico = sql("select id from contratos where nome='Centro Logístico Norte'");

exec(`insert into programacoes (id, supervisor_id, semana_inicio, semana_fim, status)
      values ('11111111-1111-1111-1111-111111111111','${aline}','2026-09-28','2026-10-02','rascunho')`);

// Uma de cada tipo, todas dentro da semana que será regravada.
exec(`insert into visitas (programacao_id, contrato_id, supervisor_id, data_prevista, origem, status, realizada_em) values
  ('11111111-1111-1111-1111-111111111111','${solar}','${aline}','2026-09-28','programada','realizada', now())`);
exec(`insert into visitas (programacao_id, contrato_id, supervisor_id, data_prevista, origem, status) values
  ('11111111-1111-1111-1111-111111111111','${colegio}','${aline}','2026-09-28','programada','cancelada')`);
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status) values
  ('${clinica}','${aline}','2026-09-29','extra','prevista')`);
// E uma prevista comum, que DEVE ser substituída pela regravação.
exec(`insert into visitas (programacao_id, contrato_id, supervisor_id, data_prevista, origem, status) values
  ('11111111-1111-1111-1111-111111111111','${logistico}','${aline}','2026-10-02','programada','prevista')`);

ok(sql("select count(*) from visitas") === '4', 'preparado: 4 visitas (1 realizada, 1 cancelada, 1 extra, 1 prevista)');

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);
await page.goto(`${B}/programacao?semana=2026-09-28`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('\n== a grade separa o que é editável do que já aconteceu ==');
const conta = async (letra) => {
  const botoes = await page.locator('tbody td button').allInnerTexts();
  return botoes.filter((t) => t.trim() === letra).length;
};
ok((await conta('P')) === 1, `1 célula P (programada em aberto, editável): ${await conta('P')}`);
ok((await conta('R')) === 1, `1 célula R (realizada): ${await conta('R')}`);
ok((await conta('E')) === 1, `1 célula E (extra): ${await conta('E')}`);

const celR = page.locator('tbody td button:has-text("R")').first();
const celE = page.locator('tbody td button:has-text("E")').first();
ok(await celR.isDisabled(), 'célula R não é clicável');
ok(await celE.isDisabled(), 'célula E não é clicável');
ok((await page.locator('tfoot td').first().innerText()).includes('3 visitas'), `rodapé soma P+R+E: ${(await page.locator('tfoot td').first().innerText()).trim()}`);

console.log('\n== regravar a semana não destrói o que já aconteceu ==');
// Muda a grade: desmarca a prevista do Centro Logístico e marca outra.
await page.locator('tbody tr', { hasText: 'Centro Logístico Norte' }).locator('td button').nth(4).click();
await page.waitForTimeout(200);
await page.locator('tbody tr', { hasText: 'Condomínio Solar das Flores' }).locator('td button').nth(1).click();
await page.waitForTimeout(300);
await page.click('button:has-text("Salvar rascunho")');
await page.waitForTimeout(3500);

ok(sql("select count(*) from visitas where status='realizada'") === '1', 'visita REALIZADA preservada');
ok(sql("select count(*) from visitas where status='cancelada'") === '1', 'visita CANCELADA preservada');
ok(sql("select count(*) from visitas where origem='extra'") === '1', 'visita EXTRA preservada');
ok(sql(`select count(*) from visitas where contrato_id='${logistico}' and status='prevista'`) === '0', 'a prevista desmarcada foi removida');
ok(sql(`select count(*) from visitas where contrato_id='${solar}' and data_prevista='2026-09-29'`) === '1', 'a nova marcação foi gravada');
ok(sql("select count(*) from visitas") === '4', `total continua coerente: ${sql("select count(*) from visitas")}`);

console.log('\n== a realizada alimenta a coluna "última visita" ==');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const linhaSolar = await page.locator('tbody tr', { hasText: 'Condomínio Solar das Flores' }).innerText();
ok(linhaSolar.includes('última visita em 28/09/2026'), `mostra a última realizada: ${JSON.stringify(linhaSolar.split('\n')[1] ?? '')}`);

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
