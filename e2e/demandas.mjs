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
const DIA = '2026-09-21';
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

exec("delete from evidencias; delete from visitas; delete from demandas_extras;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");

const browser = await chromium.launch({ executablePath: CHROMIUM });
async function entrar(email, mobile = true) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' }
      : { viewport: { width: 1280, height: 900 }, locale: 'pt-BR' },
  );
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  return { ctx, page };
}

console.log('\n===== COORDENAÇÃO CRIA DEMANDA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br', false);
  await page.goto(`${B}/meu-dia?dia=${DIA}&supervisor=${aline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  ok((await page.locator('body').innerText()).includes('Criar demanda para Aline'), 'coordenação vê o botão de criar demanda');

  console.log('-- demanda sem contrato nem data --');
  await page.click('button:has-text("Criar demanda para")');
  await page.waitForTimeout(900);
  await page.fill('textarea[name=descricao]', 'Levar os uniformes novos para a equipe.');
  await page.selectOption('select[name=prioridade]', 'alta');
  await page.fill('input[name=dataAlvo]', '');
  await page.click('button:has-text("Criar demanda")');
  await page.waitForTimeout(3500);
  ok(sql("select count(*) from demandas_extras") === '1', 'demanda criada');
  ok(sql("select prioridade from demandas_extras") === 'alta', 'prioridade gravada');
  ok(sql("select count(*) from visitas") === '0', 'sem contrato e data, NÃO cria visita');

  console.log('-- demanda com contrato e data cria a visita (seção 4.6) --');
  await page.goto(`${B}/meu-dia?dia=${DIA}&supervisor=${aline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Criar demanda para")');
  await page.waitForTimeout(900);
  await page.fill('textarea[name=descricao]', 'Conferir o mapa de frequência na unidade.');
  await page.selectOption('select[name=contratoId]', { label: 'Clínica Vida Plena' });
  await page.fill('input[name=dataAlvo]', DIA);
  await page.click('button:has-text("Criar demanda")');
  await page.waitForTimeout(3500);

  ok(sql("select count(*) from demandas_extras") === '2', '2 demandas');
  ok(sql("select count(*) from visitas") === '1', 'a visita foi criada junto');
  ok(sql("select origem from visitas") === 'demanda_coordenacao', `origem correta: ${sql("select origem from visitas")}`);
  ok(sql("select demanda_id is not null from visitas") === 't', 'visita ligada à demanda');
  ok(sql("select data_prevista from visitas") === DIA, 'na data alvo');
  await ctx.close();
}

console.log('\n===== O SUPERVISOR VÊ AS DEMANDAS NO TOPO =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const corpo = await page.locator('body').innerText();

  ok(corpo.includes('DEMANDAS DA COORDENAÇÃO'), 'bloco de demandas presente');
  const posDemandas = corpo.indexOf('DEMANDAS DA COORDENAÇÃO');
  const posVisitas = corpo.indexOf('VISITAS DE');
  ok(posDemandas < posVisitas, 'demandas vêm ANTES das visitas');
  ok(corpo.includes('Levar os uniformes'), 'primeira demanda listada');
  ok(corpo.includes('Conferir o mapa'), 'segunda demanda listada');
  ok(corpo.includes('de Carla Coord'), 'mostra quem pediu');
  ok(corpo.includes('alta'), 'mostra a prioridade');
  ok(corpo.includes('Demanda da coordenação'), 'a visita gerada aparece marcada como tal');

  ok(sql("select count(*) from demandas_extras where lida_em is not null") === '2', 'abrir o Meu dia marcou as demandas como lidas');

  console.log('-- concluir --');
  await page.locator('article', { hasText: 'Levar os uniformes' }).locator('button:has-text("Marcar como concluída")').click();
  await page.waitForTimeout(3200);
  ok(sql("select count(*) from demandas_extras where status='concluida'") === '1', 'demanda concluída');

  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const depois = await page.locator('body').innerText();
  ok(!depois.includes('Levar os uniformes'), 'some do topo depois de concluída');
  ok(depois.includes('Conferir o mapa'), 'a outra continua aberta');
  await page.screenshot({ path: raiz('telas/61-demandas.png'), fullPage: true });
  await ctx.close();
}

console.log('\n===== SUPERVISOR NÃO CRIA DEMANDA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok(!(await page.locator('body').innerText()).includes('Criar demanda'), 'supervisor não vê o formulário de demanda');
  await ctx.close();
}

console.log('\n===== DEMANDA EM CONTRATO FORA DA CARTEIRA É RECUSADA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br', false);
  await page.goto(`${B}/meu-dia?dia=${DIA}&supervisor=${aline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Criar demanda para")');
  await page.waitForTimeout(900);
  const daAline = sql("select id from contratos where nome='Clínica Vida Plena'");
  const doRafael = sql("select id from contratos where nome='Banco Central Filial RJ'");
  await page.fill('textarea[name=descricao]', 'teste de carteira');
  await page.selectOption('select[name=contratoId]', daAline);
  await page.route('**/meu-dia*', async (rota) => {
    const req = rota.request();
    if (req.method() !== 'POST') return rota.continue();
    const c = req.postData();
    if (c && c.includes(daAline)) return rota.continue({ postData: c.split(daAline).join(doRafael) });
    return rota.continue();
  });
  const antes = sql("select count(*) from demandas_extras");
  await page.click('button:has-text("Criar demanda")');
  await page.waitForTimeout(3500);
  ok(sql("select count(*) from demandas_extras") === antes, 'demanda não criada');
  ok((await page.locator('body').innerText()).includes('não está na carteira deste supervisor'), 'servidor recusa com motivo');
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
