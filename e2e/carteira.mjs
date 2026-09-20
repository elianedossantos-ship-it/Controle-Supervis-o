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
const sql = (q) => execSync(
  `PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`,
  { encoding: 'utf8' },
).trim();

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const espera = (ms = 2200) => page.waitForTimeout(ms);

await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@empresa.com.br');
await page.fill('#senha', 'admin123');
await page.click('button:has-text("Entrar")');
await espera();

console.log('\n===== CARTEIRA =====');
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });

console.log('-- todo contrato começa sem supervisor --');
let corpo = await page.locator('body').innerText();
ok(corpo.includes('Sem supervisor'), 'grupo "Sem supervisor" existe');
ok(sql("select count(*) from carteira") === '0', 'nenhum vínculo ainda');

console.log('-- atribuir Edifício Centro à Aline --');
await page.click('button:has-text("Sem supervisor")');
await espera(600);
const linha = page.locator('li', { hasText: 'Edifício Centro Empresarial' }).last();
await linha.locator('select').selectOption({ label: 'Aline Santos' });
await linha.locator('button:has-text("Mover")').click();
await espera();
ok(sql("select count(*) from carteira where fim is null") === '1', 'um vínculo vigente criado');
ok(sql("select u.nome from carteira c join usuarios u on u.id=c.supervisor_id where c.fim is null") === 'Aline Santos', 'vínculo é com a Aline');

console.log('-- a contagem da Aline subiu para 1 --');
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
const botaoAline = page.locator('button', { hasText: 'Aline Santos' }).first();
ok((await botaoAline.innerText()).includes('1'), `botão da Aline mostra a contagem: ${JSON.stringify(await botaoAline.innerText())}`);

console.log('-- mover para o Rafael: fecha o anterior e abre o novo --');
// O vínculo foi aberto hoje; para provar a preservação do histórico,
// recuo o início dele para ontem, como se já existisse.
sql("update carteira set inicio = current_date - 7 where fim is null");
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
await botaoAline.click();
await espera(600);
const linhaAline = page.locator('li', { hasText: 'Edifício Centro Empresarial' }).last();
await linhaAline.locator('select').selectOption({ label: 'Rafael Silva' });
await linhaAline.locator('button:has-text("Mover")').click();
await espera();

ok(sql("select count(*) from carteira") === '2', 'agora há 2 linhas: histórico preservado');
ok(sql("select count(*) from carteira where fim is null") === '1', 'só 1 vínculo vigente');
ok(sql("select u.nome from carteira c join usuarios u on u.id=c.supervisor_id where c.fim is null") === 'Rafael Silva', 'o vigente é o Rafael');
ok(sql("select u.nome from carteira c join usuarios u on u.id=c.supervisor_id where c.fim is not null") === 'Aline Santos', 'o fechado é o da Aline');
ok(sql("select fim = current_date from carteira where fim is not null") === 't', 'vínculo anterior fechado com fim = hoje');

console.log('-- devolver para "sem supervisor" --');
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Rafael Silva' }).first().click();
await espera(600);
const linhaRafael = page.locator('li', { hasText: 'Edifício Centro Empresarial' }).last();
await linhaRafael.locator('select').selectOption('');
await linhaRafael.locator('button:has-text("Mover")').click();
await espera();
ok(sql("select count(*) from carteira where fim is null") === '0', 'ficou sem vínculo vigente');

console.log('-- distribuir os outros contratos --');
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Sem supervisor' }).first().click();
await espera(600);
for (const [contrato, supervisor] of [
  ['Hospital São Lucas', 'Aline Santos'],
  ['Shopping Norte', 'Sandra Vianna'],
]) {
  const l = page.locator('li', { hasText: contrato }).last();
  await l.locator('select').selectOption({ label: supervisor });
  await l.locator('button:has-text("Mover")').click();
  await espera();
  await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
  await page.locator('button', { hasText: 'Sem supervisor' }).first().click();
  await espera(600);
}
ok(sql("select count(*) from carteira where fim is null") === '2', '2 contratos com supervisor vigente');

console.log('-- o índice único impede dois supervisores vigentes no mesmo contrato --');
const erro = (() => {
  try {
    sql("insert into carteira (contrato_id, supervisor_id, inicio) select c.id, u.id, current_date from contratos c, usuarios u where c.nome='Hospital São Lucas' and u.email='rafael@empresa.com.br'");
    return 'INSERIU (não deveria)';
  } catch (e) {
    return String(e.stderr ?? e.message);
  }
})();
ok(erro.includes('carteira_vigente_unica'), 'banco recusou o segundo vínculo vigente');

console.log('-- busca filtra a lista --');
await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Aline Santos' }).first().click();
await espera(600);
await page.fill('input[aria-label="Buscar contrato"]', 'palmeiras');
await espera(600);
corpo = await page.locator('body').innerText();
ok(corpo.includes('Hospital São Lucas'), 'busca por endereço encontra o contrato');

await page.fill('input[aria-label="Buscar contrato"]', '');
await espera(500);
await page.screenshot({ path: raiz('telas/11-carteira.png'), fullPage: true });
await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
