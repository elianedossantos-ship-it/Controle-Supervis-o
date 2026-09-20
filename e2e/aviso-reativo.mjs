import { chromium } from 'playwright';
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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);
// Semana do meio de outubro: serve para provar que MENSAL só avisa na última.
await page.goto(`${B}/programacao?semana=2026-10-12`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const linha = (c) => page.locator('tbody tr', { hasText: c });
const temAviso = async (c) => (await linha(c).innerText()).includes('fora da periodicidade');

console.log('== o aviso na linha acompanha os cliques ==');
ok(await temAviso('Condomínio Solar das Flores'), 'SEMANAL sem marca: avisado');
await linha('Condomínio Solar das Flores').locator('td button').nth(0).click();
await page.waitForTimeout(300);
ok(!(await temAviso('Condomínio Solar das Flores')), 'marcou 1: aviso sumiu na hora');
await linha('Condomínio Solar das Flores').locator('td button').nth(0).click();
await page.waitForTimeout(300);
ok(await temAviso('Condomínio Solar das Flores'), 'desmarcou: aviso voltou');

console.log('== 2X NA SEMANA precisa de 2 ==');
ok(await temAviso('Colégio Monte Verde'), '0 marcas: avisado');
await linha('Colégio Monte Verde').locator('td button').nth(0).click();
await page.waitForTimeout(300);
ok(await temAviso('Colégio Monte Verde'), '1 marca: ainda avisado');
await linha('Colégio Monte Verde').locator('td button').nth(4).click();
await page.waitForTimeout(300);
ok(!(await temAviso('Colégio Monte Verde')), '2 marcas: aviso sumiu');

console.log('== MENSAL no meio do mês não é avisado ==');
ok(!(await temAviso('Edifício Atlântico')), 'MENSAL sem marca, semana do meio do mês: sem aviso');

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
