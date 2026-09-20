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
const supervisorId = sql("select id from usuarios where email='aline@empresa.com.br'");
// Semana de 21/09 já ENVIADA
exec(`insert into programacoes (supervisor_id, semana_inicio, semana_fim, status, enviada_em)
      values ('${supervisorId}','2026-09-21','2026-09-25','enviada', now())`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);

// Abre a semana SEGUINTE (28/09), que está em rascunho e tem botão de salvar.
await page.goto(`${B}/programacao?semana=2026-09-28`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('tbody tr', { hasText: 'Condomínio Solar das Flores' }).locator('td button').nth(0).click();
await page.waitForTimeout(300);

// Em trânsito, aponta o POST para a semana travada.
await page.route('**/programacao*', async (rota) => {
  const req = rota.request();
  if (req.method() !== 'POST') return rota.continue();
  let corpo = req.postData();
  if (corpo && corpo.includes('2026-09-28')) {
    return rota.continue({ postData: corpo.split('2026-09-28').join('2026-09-21') });
  }
  return rota.continue();
});

await page.click('button:has-text("Salvar rascunho")');
await page.waitForTimeout(3500);

const corpo = await page.locator('body').innerText();
ok(sql("select count(*) from visitas") === '0', `nenhuma visita gravada na semana enviada: ${sql("select count(*) from visitas")}`);
ok(sql("select status from programacoes where semana_inicio='2026-09-21'") === 'enviada', 'continua enviada');
ok(corpo.includes('já foi enviada e não pode mais ser editada'), `servidor recusou: ${JSON.stringify(corpo.match(/Esta programação[^\n]*/)?.[0] ?? '(sem mensagem)')}`);

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
