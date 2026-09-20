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
const ARQUIVO = raiz('fixtures/REG-061-setembro-2026.xlsx');
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

// A suíte mede a carga inicial, então parte de uma base sem contrato nenhum.
exec('truncate table evidencias, plano_atualizacoes, planos_acao, visitas, programacoes, carteira, contatos_contrato, contratos cascade');
// A planilha traz contratos da Sandra, que está afastada: a importação precisa
// sinalizá-los em vez de criar vínculo com supervisor inativo.
exec("update usuarios set ativo = false where email = 'sandra@empresa.com.br'");

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const espera = (ms = 2500) => page.waitForTimeout(ms);

await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@empresa.com.br');
await page.fill('#senha', 'admin123');
await page.click('button:has-text("Entrar")');
await espera();

console.log('\n===== IMPORTAÇÃO DO REG-061 =====');
await page.goto(`${B}/cadastros/importacao`, { waitUntil: 'networkidle' });

console.log('-- conferência não grava nada --');
await page.setInputFiles('#arquivo', ARQUIVO);
await page.click('button:has-text("Conferir planilha")');
await espera(4000);
ok(sql('select count(*) from contratos') === '0', 'nenhum contrato gravado na conferência');

const corpo = await page.locator('body').innerText();
await page.click('button:has-text("Ver as")').catch(() => {});
await espera(800);
const tabela = await page.locator('body').innerText();

console.log('-- leu as 3 abas, com alturas de cabeçalho diferentes --');
ok(tabela.includes('Condomínio Solar das Flores'), 'leu contrato da aba 1');
ok(tabela.includes('Banco Central Filial RJ'), 'leu contrato da aba 2 (rótulo e nome em células vizinhas)');
ok(tabela.includes('Faculdade União'), 'leu contrato da aba 3');

console.log('-- a legenda no rodapé não virou contrato --');
ok(!tabela.includes('P = PROGRAMADA'), 'linha "P = PROGRAMADA" descartada');
ok(!tabela.includes('LEGENDA'), 'linha "LEGENDA" descartada');

console.log('-- variantes de grafia da periodicidade foram normalizadas --');
ok(tabela.includes('2X NA SEMANA'), '"2x semana" e "2X NA SEMANA" normalizados');
ok(tabela.includes('QUINZENAL'), '"Quinzenal" normalizado');
ok(tabela.includes('MENSAL'), '"mensal" normalizado');

console.log('-- linhas problemáticas foram sinalizadas, não importadas --');
ok(tabela.includes('Sem endereço'), 'linha sem endereço marcada');
ok(tabela.includes('não reconhecida'), 'periodicidade inválida marcada');
ok(tabela.includes('Repetido na própria planilha'), 'duplicata entre abas marcada');

console.log('-- supervisor inativo/não cadastrado é avisado --');
ok(tabela.includes('não cadastrado'), 'Sandra Vianna (inativa) sinalizada');
ok(corpo.includes('sem carteira'), 'resumo avisa sobre contratos sem carteira');

console.log('-- importar --');
await page.click('button:has-text("Importar")');
await espera(4000);
ok((await page.locator('body').innerText()).includes('Importação concluída'), 'importação concluída');

const total = sql('select count(*) from contratos');
ok(total === '9', `9 contratos criados (12 linhas - 1 sem endereço - 1 periodicidade inválida - 1 duplicata): ${total}`);

console.log('-- carteiras montadas pelas abas --');
ok(sql("select count(*) from carteira where fim is null") === '7', `7 vínculos: 5 da Aline + 2 do Rafael (Sandra inativa não recebe): ${sql("select count(*) from carteira where fim is null")}`);
ok(sql("select count(*) from carteira c join usuarios u on u.id=c.supervisor_id where u.nome='Aline Santos' and c.fim is null") === '5', 'Aline com 5 contratos');
ok(sql("select count(*) from carteira c join usuarios u on u.id=c.supervisor_id where u.nome='Rafael Silva' and c.fim is null") === '2', 'Rafael com 2 contratos');

console.log('-- os 2 da Sandra entraram sem carteira --');
ok(sql("select count(*) from contratos c left join carteira k on k.contrato_id=c.id and k.fim is null where k.id is null") === '2', 'Faculdade União e Hotel Mirante sem supervisor');

console.log('-- periodicidade gravada dentro da lista fechada --');
ok(sql("select count(*) from contratos where periodicidade not in ('SEMANAL','2X NA SEMANA','QUINZENAL','MENSAL')") === '0', 'nenhuma periodicidade fora da lista');

console.log('\n-- reimportar o mesmo arquivo não duplica --');
await page.goto(`${B}/cadastros/importacao`, { waitUntil: 'networkidle' });
await page.setInputFiles('#arquivo', ARQUIVO);
await page.click('button:has-text("Conferir planilha")');
await espera(4000);
const segunda = await page.locator('body').innerText();
ok(segunda.includes('já existem'), 'segunda conferência marca tudo como já existente');
await page.click('button:has-text("Importar")');
await espera(3000);
ok(sql('select count(*) from contratos') === '9', 'continua com 9 contratos');

await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
await page.screenshot({ path: raiz('telas/12-carteira-importada.png'), fullPage: true });

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
