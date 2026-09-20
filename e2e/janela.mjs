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

exec("delete from evidencias; delete from visitas; delete from programacoes;");

const browser = await chromium.launch({ executablePath: CHROMIUM });
async function entrar(email) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  return { ctx, page };
}

/*
 * Hoje é 2026-09-20 (domingo). A janela de uma semana que começa na segunda X
 * vai da quinta X-4 às 00h até a sexta X-3 às 18h. Então:
 *  - semana 2026-09-28: janela de 24/09 a 25/09 — ainda não abriu (antes).
 *  - semana 2026-09-21: janela de 17/09 a 18/09 — já fechou.
 */
const ABERTA_EM_BREVE = '2026-09-28';
const JA_FECHADA = '2026-09-21';

console.log('\n===== ANTES DA QUINTA: MONTA E ENVIA NORMALMENTE =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${ABERTA_EM_BREVE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('main').innerText();
  ok(corpo.includes('Prazo desta semana'), 'a tela mostra o prazo, não um bloqueio');
  ok(corpo.includes('25/09/2026'), 'nomeia a sexta em que fecha');
  ok(corpo.includes('24/09/2026'), 'e a quinta como referência');
  ok(await page.locator('button:has-text("Salvar rascunho")').count() === 1, 'dá para salvar rascunho');
  ok(await page.locator('button:has-text("Enviar")').count() >= 1, 'e o envio está disponível antes da quinta');

  await page.locator('td button:not([disabled])').first().click();
  await page.click('button:has-text("Salvar rascunho")');
  await page.waitForTimeout(3000);
  ok(sql(`select status from programacoes where semana_inicio='${ABERTA_EM_BREVE}'`) === 'rascunho',
     'rascunho salvo');

  await page.click('button:has-text("Enviar programação")');
  await page.waitForTimeout(3000);
  if (await page.locator('button:has-text("Enviar assim mesmo")').count() > 0) {
    await page.click('button:has-text("Enviar assim mesmo")');
    await page.waitForTimeout(3000);
  }
  ok(sql(`select status from programacoes where semana_inicio='${ABERTA_EM_BREVE}'`) === 'enviada',
     'o supervisor envia antes da quinta');
  await page.screenshot({ path: `${T}/71-janela-prazo.png`, fullPage: false });
  await ctx.close();
}

console.log('\n===== DEPOIS DAS 18H DA SEXTA: TRAVADA PARA O SUPERVISOR =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${JA_FECHADA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('main').innerText();
  ok(corpo.includes('Janela fechada'), 'a tela diz que fechou');
  ok(corpo.includes('18/09/2026'), 'nomeia a sexta em que fechou');
  ok(corpo.includes('Fale com a coordenação'), 'diz o que fazer');
  ok(await page.locator('button:has-text("Salvar rascunho")').count() === 0, 'sem botão de salvar');
  ok(await page.locator('td button:not([disabled])').count() === 0, 'nenhuma célula clicável');

  console.log('-- e o servidor recusa, mesmo por requisição --');
  const antes = sql(`select count(*) from programacoes where semana_inicio='${JA_FECHADA}'`);
  const resposta = await page.evaluate(async (semana) => {
    const r = await fetch(location.href, { method: 'POST', body: new FormData() });
    return r.status;
  }, JA_FECHADA);
  ok(sql(`select count(*) from programacoes where semana_inicio='${JA_FECHADA}'`) === antes,
     `nada foi gravado pela requisição crua (status ${resposta})`);
  await page.screenshot({ path: `${T}/72-janela-fechada.png` });
  await ctx.close();
}

console.log('\n===== A COORDENAÇÃO PASSA POR CIMA DA TRAVA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
  await page.goto(`${B}/programacao?semana=${JA_FECHADA}&supervisor=${aline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok(await page.locator('td button:not([disabled])').count() > 0, 'a coordenação ainda edita a semana fechada');
  await page.locator('td button:not([disabled])').first().click();
  await page.click('button:has-text("Enviar programação")');
  await page.waitForTimeout(3000);
  // Com contrato fora da periodicidade o envio pede confirmação (seção 4.2).
  if (await page.locator('button:has-text("Enviar assim mesmo")').count() > 0) {
    await page.click('button:has-text("Enviar assim mesmo")');
    await page.waitForTimeout(3000);
  }
  ok(sql(`select status from programacoes where semana_inicio='${JA_FECHADA}'`) === 'enviada',
     'e consegue enviar fora da janela');
  await ctx.close();
}

console.log('\n===== ENVIADA CONTINUA SENDO ENVIADA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${JA_FECHADA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('main').innerText();
  ok(corpo.includes('Programação enviada'), 'o supervisor vê que foi enviada');
  ok(!corpo.includes('Janela fechada'), 'e não vê o aviso de janela por cima disso');
  ok(await page.locator('button:has-text("Reabrir para edição")').count() === 0,
     'supervisor não reabre');
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
