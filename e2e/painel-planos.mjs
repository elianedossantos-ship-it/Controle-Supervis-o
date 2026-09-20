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
const T = raiz('telas');
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

exec("delete from evidencias; delete from plano_atualizacoes; delete from planos_acao;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");

// Cenário conhecido dentro de setembro/2026.
exec(`insert into planos_acao (contrato_id, aberto_por, descricao, prioridade, prazo, status, criado_em, resolvido_em) values
 ('${solar}','${aline}','Infiltração','normal','2026-09-10','aberto','2026-09-02 09:00-03',null),
 ('${solar}','${aline}','Portão','alta','2026-09-25','em_andamento','2026-09-03 09:00-03',null),
 ('${solar}','${aline}','Lâmpada','baixa','2026-09-30','resolvido','2026-09-04 09:00-03','2026-09-06 09:00-03'),
 ('${colegio}','${rafael}','Vazamento','critica','2026-09-05','aberto','2026-09-01 09:00-03',null),
 ('${colegio}','${rafael}','Grade','normal','2026-09-28','cancelado','2026-09-08 09:00-03',null)`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'carla@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2600);
await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const bloco = async (rotulo) => (await page.locator(`[data-bloco="${rotulo}"] [data-valor]`).innerText()).trim();

console.log('\n===== BLOCOS DE PLANOS NO PAINEL (seção 10.4) =====');
ok(await bloco('Planos em aberto') === '3', `em aberto = 3 (aberto+em andamento): ${await bloco('Planos em aberto')}`);
// hoje é 2026-09-20: vencem os de prazo 09-10 e 09-05; o cancelado e o resolvido não contam.
ok(await bloco('Planos vencidos') === '2', `vencidos = 2: ${await bloco('Planos vencidos')}`);
// Só o Solar tem dois planos não cancelados; o Colégio tem um cancelado.
ok(await bloco('Contratos reincidentes') === '1', `reincidentes = 1: ${await bloco('Contratos reincidentes')}`);
const medio = await bloco('Tempo médio até resolver');
ok(medio.includes('48') || medio.includes('2 d'), `tempo médio até resolver (48h): "${medio}"`);

console.log('\n===== QUEBRAS POR CONTRATO E POR SUPERVISOR =====');
const texto = await page.locator('section', { hasText: 'Planos por contrato' }).last().innerText();
ok(texto.includes('Condomínio Solar das Flores'), 'o contrato aparece no ranking');
ok(texto.includes('Aline Santos') && texto.includes('Rafael Silva'), 'os dois supervisores na tabela');
ok(texto.includes('Reincidência no período'), 'linha de reincidência nomeia os contratos');

const linhaAline = page.locator('[data-tabela="planos-por-supervisor"] tr', { hasText: 'Aline Santos' });
const celulas = (await linhaAline.locator('td').allInnerTexts()).map((t) => t.trim());
ok(JSON.stringify(celulas) === JSON.stringify(['Aline Santos', '3', '2', '1']),
   `Aline: 3 no período, 2 cobrando, 1 vencido — ${JSON.stringify(celulas)}`);
const linhaRafael = page.locator('[data-tabela="planos-por-supervisor"] tr', { hasText: 'Rafael Silva' });
const celRafael = (await linhaRafael.locator('td').allInnerTexts()).map((t) => t.trim());
ok(JSON.stringify(celRafael) === JSON.stringify(['Rafael Silva', '2', '1', '1']),
   `Rafael: 2 no período, 1 cobrando, 1 vencido — ${JSON.stringify(celRafael)}`);

console.log('\n===== O FILTRO DE SUPERVISOR ALCANÇA OS PLANOS =====');
await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30&supervisor=${rafael}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
ok(await bloco('Planos em aberto') === '1', `só os do Rafael: ${await bloco('Planos em aberto')}`);
// Rafael abriu dois no Colégio, mas um foi cancelado: plano retirado não é reincidência.
ok(await bloco('Contratos reincidentes') === '0',
   `plano cancelado não conta como reincidência: ${await bloco('Contratos reincidentes')}`);

console.log('\n===== PERÍODO SEM PLANOS =====');
await page.goto(`${B}/painel?inicio=2026-07-01&fim=2026-07-31`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
ok(await bloco('Planos em aberto') === '0', `zero fora do período: ${await bloco('Planos em aberto')}`);
const vazio = await page.locator('section', { hasText: 'Planos por contrato' }).last().innerText();
ok(vazio.includes('Nenhum plano de ação no período'), 'estado vazio fala de planos, não de cancelamentos');

await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.locator('section', { hasText: 'Planos por contrato' }).last().screenshot({ path: `${T}/70-painel-planos.png` });

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
