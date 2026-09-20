import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
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
const PDF = raiz('fixtures/nao-e-foto.pdf');
const DIA = '2026-09-21';
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();

// Estado próprio: cada suíte monta o que precisa, para não depender da ordem.
const _exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });
const _sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
_exec("delete from evidencias; delete from visitas; delete from programacoes; delete from demandas_extras;");
_exec(`insert into programacoes (id, supervisor_id, semana_inicio, semana_fim, status, enviada_em)
  select '22222222-2222-2222-2222-222222222222', id, '2026-09-21','2026-09-25','enviada', now()
  from usuarios where email='aline@empresa.com.br'`);
_exec(`insert into visitas (programacao_id, contrato_id, supervisor_id, data_prevista, origem, status)
  select '22222222-2222-2222-2222-222222222222', c.id, u.id, '2026-09-21', 'programada', 'prevista'
  from contratos c, usuarios u where u.email='aline@empresa.com.br'
  and c.nome in ('Condomínio Solar das Flores','Colégio Monte Verde','Clínica Vida Plena')`);
_exec("delete from contatos_contrato where nome='Marcos Oliveira'");
_exec(`insert into contatos_contrato (contrato_id, nome, cargo, telefone, principal)
  select id, 'Marcos Oliveira', 'Síndico', '(21) 98888-1234', true from contratos where nome='Condomínio Solar das Flores'`);
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

writeFileSync(PDF, '%PDF-1.4\n% nao e foto\n');

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function entrar(email, opcoes = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR',
    ...opcoes,
  });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  return { ctx, page };
}

console.log('\n===== GPS NEGADO NÃO TRAVA O REGISTRO (seção 4.5) =====');
{
  // Reseta uma visita para prevista
  exec("delete from evidencias; update visitas set status='prevista', realizada_em=null, motivo_id=null, motivo_outro=null, observacao=null");

  // Sem permissão de geolocalização
  const { ctx, page } = await entrar('aline@empresa.com.br', { permissions: [] });
  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('article', { hasText: 'Clínica Vida Plena' }).locator('button:has-text("Realizada")').click();
  await page.waitForTimeout(3000);

  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('sem localização') || corpo.includes('negada') || corpo.includes('não consegui') || corpo.includes('Não consegui'),
    `avisa que ficará sem localização: ${JSON.stringify(corpo.match(/(Localização negada|Não consegui[^\n]*)/)?.[0] ?? '')}`);

  await page.locator('input[type=file]').first().setInputFiles(FOTO);
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Confirmar visita")').click();
  await page.waitForTimeout(3500);

  const clinica = sql("select id from contratos where nome='Clínica Vida Plena'");
  ok(sql(`select status from visitas where contrato_id='${clinica}'`) === 'realizada', 'visita REGISTRADA mesmo sem GPS');
  ok(sql("select count(*) from evidencias") === '1', 'evidência gravada');
  ok(sql("select latitude is null and longitude is null from evidencias limit 1") === 't', 'sem coordenadas na base');
  ok(sql("select capturado_em is not null from evidencias limit 1") === 't', 'horário do servidor mesmo assim');

  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok((await page.locator('body').innerText()).includes('sem localização'), 'o cartão mostra "sem localização"');
  await ctx.close();
}

console.log('\n===== ARQUIVO QUE NÃO É FOTO É RECUSADO =====');
{
  exec("delete from evidencias; update visitas set status='prevista', realizada_em=null");
  const { ctx, page } = await entrar('aline@empresa.com.br', { permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -43.1, accuracy: 10 } });
  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('article', { hasText: 'Clínica Vida Plena' }).locator('button:has-text("Realizada")').click();
  await page.waitForTimeout(1500);
  await page.locator('input[type=file]').first().setInputFiles(PDF);
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Confirmar visita")').click();
  await page.waitForTimeout(3000);
  ok(sql("select count(*) from evidencias") === '0', 'PDF não virou evidência');
  ok((await page.locator('body').innerText()).includes('precisa ser uma foto'), 'servidor explica o motivo');
  await ctx.close();
}

// (a checagem de carteira alheia vive em acesso-visita.mjs, com UUIDs reais)

console.log('\n===== FOTO DE OUTRA CARTEIRA NÃO É SERVIDA =====');
{
  exec("delete from evidencias; update visitas set status='prevista', realizada_em=null");
  const { ctx, page } = await entrar('aline@empresa.com.br', { permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -43.1, accuracy: 10 } });
  await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('article').first().locator('button:has-text("Realizada")').click();
  await page.waitForTimeout(1500);
  await page.locator('input[type=file]').first().setInputFiles(FOTO);
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Confirmar visita")').click();
  await page.waitForTimeout(3500);
  const url = sql("select arquivo_url from evidencias limit 1");
  ok(url.length > 0, 'a Aline tem uma evidência');

  const propria = await page.request.get(`${B}${url}`);
  ok(propria.status() === 200, 'a dona acessa a própria foto');
  await ctx.close();

  const { ctx: ctx2, page: p2 } = await entrar('rafael@empresa.com.br');
  const alheia = await p2.request.get(`${B}${url}`);
  ok(alheia.status() === 403, `outro supervisor recebe 403: ${alheia.status()}`);
  await ctx2.close();

  const anon = await browser.newContext();
  const semSessao = await anon.request.get(`${B}${url}`);
  ok(semSessao.status() === 401, `sem sessão recebe 401: ${semSessao.status()}`);
  await anon.close();

  const { ctx: ctx3, page: p3 } = await entrar('carla@empresa.com.br');
  const coord = await p3.request.get(`${B}${url}`);
  ok(coord.status() === 200, `coordenador acessa (vê todas as carteiras): ${coord.status()}`);
  await ctx3.close();
}

console.log('\n===== CANCELAR É SÓ DO DONO DA VISITA (seção 4.3) =====');
{
  exec("delete from evidencias; update visitas set status='prevista', realizada_em=null, motivo_id=null");
  const { ctx, page } = await entrar('carla@empresa.com.br');
  const idAline = sql("select id from usuarios where email='aline@empresa.com.br'");
  await page.goto(`${B}/meu-dia?dia=${DIA}&supervisor=${idAline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Condomínio Solar das Flores'), 'coordenação vê o dia do supervisor');
  ok(!corpo.includes('Confirmar cancelamento'), 'coordenação não tem o botão de cancelar');
  ok(!corpo.includes('+ Visita extra'), 'coordenação não lança visita extra pelo dia do outro');
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
