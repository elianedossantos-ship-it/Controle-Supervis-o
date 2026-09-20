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

for (const args of [[], ['--lang=pt-BR']]) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args,
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'aline@empresa.com.br');
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  await page.goto(`${B}/meu-dia?dia=2026-09-21`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const idioma = await page.evaluate(() => navigator.language);
  const mostrado = await page.locator('input[type=date]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { largura: Math.round(r.width) };
  });
  // O texto visível do input nativo não sai no innerText; uso screenshot do campo.
  await page.locator('input[type=date]').first().screenshot({
    path: raiz(args.length ? 'telas/data-ptbr.png' : 'telas/data-padrao.png'),
  });
  console.log(`args=${JSON.stringify(args)} navigator.language=${idioma} largura=${mostrado.largura}px`);
  await browser.close();
}
