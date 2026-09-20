import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync, statSync } from 'fs';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Caminhos relativos a esta pasta — a suíte roda de qualquer lugar. */
const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (p) => resolve(AQUI, p);

/** Porta e navegador vêm do ambiente, com o padrão do desenvolvimento. */
const PORTA = process.env.E2E_PORTA ?? '3000';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';


const B = `http://localhost:${PORTA}`;
const OUT = raiz('saida');
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });
execSync(`mkdir -p ${OUT}`);

// Cenário conhecido em setembro/2026 para a Aline.
exec("delete from evidencias; delete from visitas; delete from programacoes; delete from feriados;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");

exec(`insert into feriados (data, descricao, abrangencia) values ('2026-09-07','Independência','nacional')`);
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status, realizada_em) values
 ('${solar}','${aline}','2026-09-08','programada','realizada','2026-09-08 10:00-03'),
 ('${solar}','${aline}','2026-09-15','programada','cancelada',null),
 ('${colegio}','${aline}','2026-09-16','extra','prevista',null),
 ('${colegio}','${aline}','2026-09-23','programada','prevista',null)`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'pt-BR' });
const page = await ctx.newPage();
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'carla@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2600);

console.log('\n===== TELA DE EXPORTAÇÃO =====');
await page.goto(`${B}/exportar`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.fill('#competencia', '2026-09');
await page.waitForTimeout(2500);
let corpo = await page.locator('body').innerText();
ok(corpo.includes('Aline Santos'), 'a prévia lista os supervisores');
ok(/R\s*1/.test(corpo), `prévia conta as realizadas: ${JSON.stringify(corpo.match(/[RCEPF] \d+/g) ?? [])}`);
ok(corpo.includes('contratos na carteira do mês'), 'prévia diz quantos contratos entram');

console.log('\n===== EXCEL =====');
const respXlsx = await page.request.get(`${B}/api/exportar/reg061?competencia=2026-09&supervisor=${aline}&formato=xlsx`);
ok(respXlsx.status() === 200, `download respondeu 200: ${respXlsx.status()}`);
ok((respXlsx.headers()['content-type'] ?? '').includes('spreadsheetml'), 'content-type de xlsx');
ok((respXlsx.headers()['content-disposition'] ?? '').includes('REG-061-2026-09-aline-santos.xlsx'),
   `nome do arquivo: ${respXlsx.headers()['content-disposition']}`);

const xlsx = await respXlsx.body();
writeFileSync(`${OUT}/REG-061-2026-09-aline.xlsx`, xlsx);
ok(statSync(`${OUT}/REG-061-2026-09-aline.xlsx`).size > 3000, `arquivo com ${xlsx.length} bytes`);

// Abre o arquivo gerado e confere o conteúdo, célula a célula.
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(xlsx);
ok(wb.worksheets.length === 1, `1 aba (um supervisor): ${wb.worksheets.length}`);
const ws = wb.worksheets[0];
ok(ws.name === 'Aline Santos', `aba com o nome do supervisor: ${ws.name}`);

const txt = (r, c) => String(ws.getCell(r, c).value ?? '').trim();
ok(txt(1, 1) === 'Nº: REG-061', `cabeçalho Nº: ${txt(1, 1)}`);
ok(txt(2, 1) === 'REV: 04', `cabeçalho REV: ${txt(2, 1)}`);
ok(txt(3, 1) === 'Data:', 'campo Data:');
ok(txt(4, 1) === 'MÊS/ANO: SETEMBRO/2026', `MÊS/ANO: ${txt(4, 1)}`);
ok(txt(5, 1) === 'SUPERVISOR(A): Aline Santos', `SUPERVISOR(A): ${txt(5, 1)}`);
ok(txt(6, 1) === 'CLIENTE' && txt(6, 2) === 'ENDEREÇO' && txt(6, 3) === 'PERIODICIDADE DA VISITA',
   'colunas fixas do REG-061');

// Colunas 1..30 de setembro
ok(txt(6, 4) === '1' && txt(6, 33) === '30', `dias 1 a 30 nas colunas: ${txt(6, 4)}..${txt(6, 33)}`);
ok(String(ws.getCell(6, 34).value ?? '') === '', 'não há coluna 31 em setembro');

// Linha do Condomínio Solar das Flores
let linhaSolar = 0;
for (let r = 7; r < 30; r++) if (txt(r, 1) === 'Condomínio Solar das Flores') linhaSolar = r;
ok(linhaSolar > 0, 'contrato da carteira aparece como linha');
const celDia = (linha, dia) => txt(linha, 3 + dia);
ok(celDia(linhaSolar, 8) === 'R', `dia 8 realizada = R: "${celDia(linhaSolar, 8)}"`);
ok(celDia(linhaSolar, 15) === 'C', `dia 15 cancelada = C: "${celDia(linhaSolar, 15)}"`);
ok(celDia(linhaSolar, 7) === 'F', `dia 7 feriado = F: "${celDia(linhaSolar, 7)}"`);
ok(celDia(linhaSolar, 5) === 'S', `dia 5 sábado = S: "${celDia(linhaSolar, 5)}"`);
ok(celDia(linhaSolar, 6) === 'D', `dia 6 domingo = D: "${celDia(linhaSolar, 6)}"`);
ok(celDia(linhaSolar, 9) === '', 'dia útil sem visita fica em branco');

let linhaColegio = 0;
for (let r = 7; r < 30; r++) if (txt(r, 1) === 'Colégio Monte Verde') linhaColegio = r;
ok(celDia(linhaColegio, 16) === 'E', `dia 16 extra = E: "${celDia(linhaColegio, 16)}"`);
ok(celDia(linhaColegio, 23) === 'P', `dia 23 programada = P: "${celDia(linhaColegio, 23)}"`);

console.log('\n-- legenda e periodicidade no canto direito --');
const colLegenda = 35; // última coluna de dia (33) + 2
ok(txt(6, colLegenda) === 'LEGENDA', `bloco LEGENDA: "${txt(6, colLegenda)}"`);
const letras = [];
for (let r = 7; r <= 13; r++) letras.push(txt(r, colLegenda));
ok(letras.join('') === 'RECPFSD', `as 7 marcações na legenda: ${letras.join('')}`);
ok(txt(7, colLegenda + 1) === 'Realizada', 'legenda descreve R');
let achouPeriodicidade = false;
for (let r = 13; r <= 22; r++) if (txt(r, colLegenda) === 'PERIODICIDADE') achouPeriodicidade = true;
ok(achouPeriodicidade, 'bloco PERIODICIDADE presente');

console.log('\n-- assinaturas --');
let achouAssinatura = false;
for (let r = 7; r <= 30; r++) if (txt(r, 1).startsWith('Assinatura')) achouAssinatura = true;
ok(achouAssinatura, 'campo de assinatura no rodapé');

console.log('\n===== TODOS OS SUPERVISORES: UMA ABA CADA =====');
const respTodos = await page.request.get(`${B}/api/exportar/reg061?competencia=2026-09&formato=xlsx`);
const wbTodos = new ExcelJS.Workbook();
await wbTodos.xlsx.load(await respTodos.body());
const nomesAbas = wbTodos.worksheets.map((w) => w.name);
ok(nomesAbas.length >= 2, `uma aba por supervisor: ${JSON.stringify(nomesAbas)}`);
ok(nomesAbas.includes('Aline Santos') && nomesAbas.includes('Rafael Silva'), 'abas com os nomes certos');

console.log('\n===== PDF =====');
const respPdf = await page.request.get(`${B}/api/exportar/reg061?competencia=2026-09&supervisor=${aline}&formato=pdf`);
ok(respPdf.status() === 200, `download respondeu 200: ${respPdf.status()}`);
ok((respPdf.headers()['content-type'] ?? '').includes('application/pdf'), 'content-type de pdf');
const pdf = await respPdf.body();
writeFileSync(`${OUT}/REG-061-2026-09-aline.pdf`, pdf);
ok(pdf.subarray(0, 5).toString() === '%PDF-', 'começa com a assinatura %PDF-');
ok(pdf.length > 2000, `arquivo com ${pdf.length} bytes`);

console.log('\n===== VALIDAÇÕES DA ROTA =====');
const ruim = await page.request.get(`${B}/api/exportar/reg061?competencia=2026-13&formato=xlsx`);
ok(ruim.status() === 400, `competência inválida devolve 400: ${ruim.status()}`);
const semMes = await page.request.get(`${B}/api/exportar/reg061?formato=xlsx`);
ok(semMes.status() === 400, `sem competência devolve 400: ${semMes.status()}`);

await ctx.close();
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${B}/login`, { waitUntil: 'networkidle' });
await p2.fill('#email', 'aline@empresa.com.br');
await p2.fill('#senha', 'senha12345');
await p2.click('button:has-text("Entrar")');
await p2.waitForTimeout(2600);
await p2.goto(`${B}/exportar`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(1200);
ok(new URL(p2.url()).pathname === '/sem-acesso', `supervisor não exporta: ${new URL(p2.url()).pathname}`);
const rotaDireta = await p2.request.get(`${B}/api/exportar/reg061?competencia=2026-09&formato=xlsx`);
ok([302, 303, 307, 403, 404].includes(rotaDireta.status()) || rotaDireta.url().includes('sem-acesso'),
   `rota de download barrada para supervisor: status ${rotaDireta.status()}, url ${rotaDireta.url().slice(-20)}`);
await ctx2.close();

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
