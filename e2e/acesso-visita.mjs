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
const FOTO = raiz('fixtures/foto-teste.jpg');
const DIA = '2026-09-21';
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

exec("delete from evidencias; delete from visitas; delete from demandas_extras;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const banco = sql("select id from contratos where nome='Banco Central Filial RJ'");

// UUIDs gerados pelo Postgres: um id escrito à mão pode não ser UUID válido
// pela RFC, e aí o zod recusaria antes de a regra de propriedade ser exercitada.
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status) values ('${solar}','${aline}','${DIA}','programada','prevista'), ('${banco}','${rafael}','${DIA}','programada','prevista')`);
const VISITA_ALINE = sql(`select id from visitas where supervisor_id='${aline}'`);
const VISITA_RAFAEL = sql(`select id from visitas where supervisor_id='${rafael}'`);
console.log(`  (visita da Aline: ${VISITA_ALINE} | do Rafael: ${VISITA_RAFAEL})`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR',
  permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -43.1, accuracy: 10 },
});
const page = await ctx.newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2600);

const trocar = async (de, para) => {
  await page.unroute('**/meu-dia*').catch(() => {});
  await page.route('**/meu-dia*', async (rota) => {
    const req = rota.request();
    if (req.method() !== 'POST') return rota.continue();
    const c = req.postData();
    if (c && c.includes(de)) return rota.continue({ postData: c.split(de).join(para) });
    return rota.continue();
  });
};

console.log('\n===== REGISTRAR VISITA DE OUTRO SUPERVISOR =====');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok(!(await page.locator('body').innerText()).includes('Banco Central'), 'não vê a visita do Rafael na tela');

await page.locator('article', { hasText: 'Condomínio Solar das Flores' }).locator('button:has-text("Realizada")').click();
await page.waitForTimeout(1600);
await page.locator('input[type=file]').first().setInputFiles(FOTO);
await page.waitForTimeout(700);
await trocar(VISITA_ALINE, VISITA_RAFAEL);
await page.locator('button:has-text("Confirmar visita")').click();
await page.waitForTimeout(3800);

const corpo = await page.locator('body').innerText();
ok(sql(`select status from visitas where id='${VISITA_RAFAEL}'`) === 'prevista', 'a visita do Rafael continua prevista');
ok(sql(`select status from visitas where id='${VISITA_ALINE}'`) === 'prevista', 'a da Aline também não foi registrada');
ok(sql("select count(*) from evidencias") === '0', 'nenhuma evidência gravada');
ok(corpo.includes('não é da sua carteira'), `servidor recusa: ${JSON.stringify(corpo.match(/Esta visita[^\n]*/)?.[0] ?? '(nenhuma)')}`);

console.log('\n===== CANCELAR VISITA DE OUTRO SUPERVISOR =====');
await page.unroute('**/meu-dia*');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('article', { hasText: 'Condomínio Solar das Flores' }).locator('button:has-text("Cancelar")').click();
await page.waitForTimeout(1200);
await page.selectOption('select[name=motivoId]', { label: 'Veículo em manutenção' });
await page.waitForTimeout(400);
await trocar(VISITA_ALINE, VISITA_RAFAEL);
await page.locator('button:has-text("Confirmar cancelamento")').click();
await page.waitForTimeout(3500);

const corpo2 = await page.locator('body').innerText();
ok(sql(`select status from visitas where id='${VISITA_RAFAEL}'`) === 'prevista', 'visita do Rafael não foi cancelada');
ok(corpo2.includes('dono da visita'), `mensagem da seção 4.3: ${JSON.stringify(corpo2.match(/Só o supervisor[^\n]*/)?.[0] ?? '(nenhuma)')}`);

console.log('\n===== VISITA EXTRA EM CONTRATO DE OUTRA CARTEIRA =====');
await page.unroute('**/meu-dia*');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('button:has-text("+ Visita extra")').click();
await page.waitForTimeout(900);
const opcoes = await page.locator('select[name=contratoId] option').allInnerTexts();
ok(!opcoes.some((o) => o.includes('Banco Central')), 'contrato de outra carteira não é ofertado');

const meuContrato = sql("select id from contratos where nome='Edifício Atlântico'");
await page.selectOption('select[name=contratoId]', meuContrato);
await page.fill('textarea[name=justificativa]', 'teste');
await trocar(meuContrato, banco);
await page.locator('button:has-text("Lançar visita extra")').click();
await page.waitForTimeout(3500);
ok(sql("select count(*) from visitas where origem='extra'") === '0', 'nenhuma extra criada em carteira alheia');
ok((await page.locator('body').innerText()).includes('não está na sua carteira'), 'servidor recusa');

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
