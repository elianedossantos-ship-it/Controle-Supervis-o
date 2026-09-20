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
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

// Cenário montado do zero, com números que eu conheço de antemão.
exec("delete from evidencias; delete from visitas; delete from programacoes; delete from demandas_extras;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");
const logistico = sql("select id from contratos where nome='Centro Logístico Norte'");
const atlantico = sql("select id from contratos where nome='Edifício Atlântico'");
const banco = sql("select id from contratos where nome='Banco Central Filial RJ'");

// Aline: 4 programadas (3 realizadas, 1 cancelada) + 1 extra realizada
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status, realizada_em) values
 ('${solar}','${aline}','2026-09-07','programada','realizada','2026-09-07 10:00-03'),
 ('${solar}','${aline}','2026-09-14','programada','realizada','2026-09-14 10:00-03'),
 ('${colegio}','${aline}','2026-09-08','programada','realizada','2026-09-08 10:00-03'),
 ('${logistico}','${aline}','2026-09-09','programada','cancelada',null),
 ('${atlantico}','${aline}','2026-09-10','extra','realizada','2026-09-10 14:00-03')`);
// Rafael: 2 programadas, 1 realizada
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status, realizada_em) values
 ('${banco}','${rafael}','2026-09-15','programada','realizada','2026-09-15 09:00-03'),
 ('${banco}','${rafael}','2026-09-22','programada','prevista',null)`);

// 2 cancelamentos com motivos diferentes para o ranking
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status) values
 ('${colegio}','${aline}','2026-09-16','programada','cancelada'),
 ('${colegio}','${aline}','2026-09-17','programada','cancelada')`);
exec(`update visitas set motivo_id=(select id from motivos_cancelamento where ordem=8) where status='cancelada' and data_prevista in ('2026-09-09','2026-09-16')`);
exec(`update visitas set motivo_id=(select id from motivos_cancelamento where ordem=11) where status='cancelada' and data_prevista='2026-09-17'`);

// GPS em 3 das 5 realizadas; 2 ficam sem
exec(`insert into evidencias (visita_id, arquivo_url, latitude, longitude, precisao_m, capturado_em)
 select id, '/api/evidencias/evidencias/2026/09/00000000-0000-4000-8000-000000000009.jpg', -22.9, -43.1, 10.0, realizada_em
 from visitas where status='realizada' order by data_prevista limit 3`);

// Demandas: 1 aberta, 2 concluídas (4 h e 8 h)
exec(`insert into demandas_extras (criado_por, supervisor_id, descricao, status, criado_em, concluida_em)
 select c.id, '${aline}', 'demanda A', 'concluida', '2026-09-10 08:00-03', '2026-09-10 12:00-03' from usuarios c where c.papel='coordenador' limit 1`);
exec(`insert into demandas_extras (criado_por, supervisor_id, descricao, status, criado_em, concluida_em)
 select c.id, '${aline}', 'demanda B', 'concluida', '2026-09-11 08:00-03', '2026-09-11 16:00-03' from usuarios c where c.papel='coordenador' limit 1`);
exec(`insert into demandas_extras (criado_por, supervisor_id, descricao, status, criado_em)
 select c.id, '${aline}', 'demanda C', 'aberta', '2026-09-12 08:00-03' from usuarios c where c.papel='coordenador' limit 1`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'carla@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2600);

const bloco = async (rotulo) =>
  (await page.locator(`[data-bloco="${rotulo}"] [data-valor]`).innerText()).trim();

// As asserções de conteúdo olham só as tabelas: o corpo inclui as opções dos
// seletores de filtro, que listam todos os supervisores e contratos.
const tabelas = async () =>
  (await page.locator('table').allInnerTexts()).join('\n');

console.log('\n===== SETEMBRO INTEIRO, SEM FILTRO DE SUPERVISOR =====');
await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
let corpo = await page.locator('body').innerText();

// Programadas = 7 (4 Aline + 2 cancel. extras Aline = 6? vamos conferir) :
// Aline programadas: solar 7, solar 14, colegio 8, logistico 9, colegio 16, colegio 17 = 6
// Rafael programadas: banco 15, banco 22 = 2  -> total 8
// Realizadas programadas: solar7, solar14, colegio8, banco15 = 4
// Extras realizadas: atlantico 10 = 1 -> (4+1)/8 = 62,5%
ok(corpo.includes('62,5%'), `aderência geral (4+1)/8 = 62,5%: ${JSON.stringify(corpo.match(/\d+,\d%/g)?.slice(0, 3) ?? [])}`);
ok(corpo.includes('4 de 8 programadas, mais 1 extra'), 'o apoio explica a conta');

ok((await bloco('Visitas realizadas')) === '5', `visitas realizadas = 5: ${await bloco('Visitas realizadas')}`);
ok((await bloco('Cancelamentos')) === '3', `cancelamentos = 3: ${await bloco('Cancelamentos')}`);
ok((await bloco('Visitas extras')) === '1', `extras = 1: ${await bloco('Visitas extras')}`);
ok(corpo.includes('20,0% do total realizado'), '1 de 5 realizadas = 20%');
ok((await bloco('Registros sem localização')) === '2', `sem GPS = 2 (5 realizadas, 3 com GPS): ${await bloco('Registros sem localização')}`);

console.log('\n-- demandas --');
ok((await bloco('Demandas abertas')) === '1', `1 aberta: ${await bloco('Demandas abertas')}`);
ok((await bloco('Demandas concluídas')) === '2', `2 concluídas: ${await bloco('Demandas concluídas')}`);
ok(corpo.includes('6,0 h'), `tempo médio (4h e 8h) = 6,0 h: ${JSON.stringify(corpo.match(/[\d,]+ h/g) ?? [])}`);

console.log('\n-- ranking de cancelamentos --');
ok(corpo.includes('Veículo em manutenção'), 'motivo mais frequente listado');
ok(corpo.includes('Trânsito / deslocamento'), 'segundo motivo listado');
const ordem = corpo.indexOf('Veículo em manutenção') < corpo.indexOf('Trânsito / deslocamento');
ok(ordem, 'o de maior contagem (2) vem antes do de menor (1)');

console.log('\n-- aderência por supervisor --');
// Aline: programadas 6, realizadas 3, extra 1 -> (3+1)/6 = 66,7%
// Rafael: programadas 2, realizadas 1, extra 0 -> 50,0%
ok(corpo.includes('66,7%'), 'Aline (3+1)/6 = 66,7%');
ok(corpo.includes('50,0%'), 'Rafael 1/2 = 50,0%');

console.log('\n===== FILTRO POR SUPERVISOR =====');
await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30&supervisor=${rafael}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
corpo = await page.locator('body').innerText();
ok(corpo.includes('50,0%'), 'aderência do Rafael isolada');
ok(!(await tabelas()).includes('Aline Santos'), 'nenhuma linha da Aline nas tabelas');
ok((await bloco('Cancelamentos')) === '0', 'Rafael não tem cancelamentos');

console.log('\n===== FILTRO POR CONTRATO =====');
await page.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30&contrato=${solar}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
corpo = await page.locator('body').innerText();
ok(corpo.includes('100,0%'), 'Solar das Flores: 2 de 2 = 100%');
ok(!(await tabelas()).includes('Banco Central'), 'nenhuma linha de outro contrato nas tabelas');

console.log('\n===== PERÍODO SEM MOVIMENTO =====');
await page.goto(`${B}/painel?inicio=2026-01-01&fim=2026-01-31`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
corpo = await page.locator('body').innerText();
ok(corpo.includes('—'), 'aderência indefinida vira travessão, não 0%');
ok(corpo.includes('Nenhuma visita programada no período'), 'explica por que está vazio');
ok(corpo.includes('Nenhum cancelamento no período'), 'lista vazia com mensagem');

console.log('\n===== SUPERVISOR NÃO ALCANÇA O PAINEL =====');
await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const p2 = await ctx2.newPage();
await p2.goto(`${B}/login`, { waitUntil: 'networkidle' });
await p2.fill('#email', 'aline@empresa.com.br');
await p2.fill('#senha', 'senha12345');
await p2.click('button:has-text("Entrar")');
await p2.waitForTimeout(2600);
await p2.goto(`${B}/painel?inicio=2026-09-01&fim=2026-09-30`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(1200);
ok(new URL(p2.url()).pathname === '/sem-acesso', `supervisor barrado: ${new URL(p2.url()).pathname}`);
await ctx2.close();

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
