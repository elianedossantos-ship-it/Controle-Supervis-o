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
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);
await page.goto(`${B}/programacao?semana=2026-09-28`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const medidas = await page.evaluate(() => {
  const cont = [...document.querySelectorAll('div')].find((d) => d.className.includes('overflow-x-auto') && d.querySelector('table'));
  return cont ? { scrollWidth: cont.scrollWidth, clientWidth: cont.clientWidth, rolavel: cont.scrollWidth > cont.clientWidth } : null;
});
console.log('  medidas da grade:', JSON.stringify(medidas));
ok(medidas?.rolavel === true, 'a grade é rolável na horizontal');

// Rola até o fim e confirma que sexta fica alcançável e clicável
await page.evaluate(() => {
  const cont = [...document.querySelectorAll('div')].find((d) => d.className.includes('overflow-x-auto') && d.querySelector('table'));
  cont.scrollLeft = cont.scrollWidth;
});
await page.waitForTimeout(600);
await page.screenshot({ path: raiz('telas/43-programacao-mobile-rolada.png') });

const sexVisivel = await page.locator('thead th', { hasText: 'Sex' }).isVisible();
ok(sexVisivel, 'coluna de sexta alcançada por rolagem');

const btnSex = page.locator('tbody tr', { hasText: 'Centro Logístico Norte' }).locator('td button').nth(4);
await btnSex.click();
await page.waitForTimeout(400);
ok((await btnSex.innerText()).trim() === 'P', 'célula de sexta clicável no celular');

const colunaContrato = await page.evaluate(() => {
  const td = document.querySelector('tbody tr td');
  return getComputedStyle(td).position;
});
ok(colunaContrato === 'sticky', `coluna do contrato fica fixa ao rolar (position: ${colunaContrato})`);

const estouraPagina = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!estouraPagina, 'a página em si não rola na horizontal');

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
