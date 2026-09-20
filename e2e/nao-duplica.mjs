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

exec("delete from visitas; delete from programacoes;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const clinica = sql("select id from contratos where nome='Clínica Vida Plena'");
const logistico = sql("select id from contratos where nome='Centro Logístico Norte'");

exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status, realizada_em)
      values ('${solar}','${aline}','2026-09-28','programada','realizada', now())`);
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status)
      values ('${clinica}','${aline}','2026-09-29','extra','prevista')`);

const LEGITIMA = `${logistico}|2026-09-29`;
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);

let troca = null;
await page.route('**/programacao*', async (rota) => {
  const req = rota.request();
  if (req.method() !== 'POST' || !troca) return rota.continue();
  const corpo = req.postData();
  if (corpo && corpo.includes(LEGITIMA)) {
    return rota.continue({ postData: corpo.split(LEGITIMA).join(troca) });
  }
  return rota.continue();
});

async function tentar(celula) {
  await page.goto(`${B}/programacao?semana=2026-09-28`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('tbody tr', { hasText: 'Centro Logístico Norte' }).locator('td button').nth(1).click();
  await page.waitForTimeout(300);
  const antes = sql("select count(*) from visitas");
  troca = celula;
  await page.click('button:has-text("Salvar rascunho")');
  await page.waitForTimeout(3000);
  troca = null;
  const corpo = await page.locator('body').innerText();
  return { antes, depois: sql("select count(*) from visitas"), corpo };
}

console.log('\n== POST forjado sobre célula de visita JÁ REALIZADA ==');
let r = await tentar(`${solar}|2026-09-28`);
ok(r.depois === '2' && r.corpo.includes('não se reprograma'),
  `recusado, base intacta (${r.depois} visitas): ${JSON.stringify(r.corpo.match(/Já existe visita[^\n]*/)?.[0] ?? '')}`);
ok(sql(`select count(*) from visitas where contrato_id='${solar}' and data_prevista='2026-09-28'`) === '1', 'sem duplicata da realizada');

console.log('\n== POST forjado sobre célula de visita EXTRA ==');
r = await tentar(`${clinica}|2026-09-29`);
ok(r.depois === '2' && r.corpo.includes('não se reprograma'), `recusado, base intacta (${r.depois} visitas)`);
ok(sql(`select count(*) from visitas where contrato_id='${clinica}' and data_prevista='2026-09-29'`) === '1', 'sem duplicata da extra');

console.log('\n== célula livre ainda passa ==');
r = await tentar(LEGITIMA);
ok(r.depois === '3', `gravou a célula legítima: ${r.depois} visitas`);

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
