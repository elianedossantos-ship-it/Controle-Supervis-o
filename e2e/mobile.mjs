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
const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@empresa.com.br');
await page.fill('#senha', 'admin123');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);

for (const [rota, arquivo] of [
  ['/cadastros/carteira', 'telas/20-carteira-mobile.png'],
  ['/cadastros/contratos', 'telas/21-contratos-mobile.png'],
]) {
  await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: raiz(arquivo), fullPage: true });
  // Checa rolagem horizontal da página, que quebra o uso com uma mão.
  const estoura = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${rota}: rolagem horizontal da página = ${estoura ? 'SIM (ruim)' : 'não'}`);
}
await browser.close();
