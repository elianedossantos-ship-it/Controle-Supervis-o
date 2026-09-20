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

const SEMANA = '2026-09-28'; // segunda; 30/09 feriado nacional, 01/10 municipal no Rio

const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });
// A suíte semeia os próprios feriados: um nacional na quarta e um municipal do
// Rio na quinta, que é o par que prova a regra de alcance.
exec("delete from feriados where data in ('2026-09-30','2026-10-01')");
exec(`insert into feriados (data, descricao, abrangencia, uf, municipio) values
 ('2026-09-30','Feriado Nacional de Teste','nacional',null,null),
 ('2026-10-01','Aniversário do Rio','municipal','RJ','Rio de Janeiro')`);
exec(`delete from visitas where data_prevista between '${SEMANA}' and '2026-10-02'`);
exec(`delete from programacoes where semana_inicio = '${SEMANA}'`);
// O alcance do feriado depende da cidade do contrato, então a suíte define as
// três que interessam: uma no Rio, uma em SP e uma em Niterói.
exec("update contratos set cidade='Rio de Janeiro', uf='RJ' where nome='Condomínio Solar das Flores'");
exec("update contratos set cidade='São Paulo', uf='SP' where nome='Edifício Atlântico'");
exec("update contratos set cidade='Niterói', uf='RJ' where nome='Clínica Vida Plena'");

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const espera = (ms = 2500) => page.waitForTimeout(ms);

await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await espera();
if (new URL(page.url()).pathname === '/login') {
  console.log('  (senha da Aline diferente; redefinindo via banco não é possível — abortando)');
  process.exit(1);
}

console.log('\n===== GRADE DA SEMANA =====');
await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
await espera(1200);

const corpo = await page.locator('body').innerText();
ok(corpo.includes('28 de setembro a 2 de outubro de 2026'), 'cabeçalho mostra a semana que cruza o mês');
ok(corpo.includes('Condomínio Solar das Flores'), 'lista os contratos da carteira');
ok(!corpo.includes('Banco Central'), 'não mostra contrato de outro supervisor');

console.log('-- só segunda a sexta --');
const cabecalhos = await page.locator('thead th').allInnerTexts();
ok(cabecalhos.length === 6, `1 coluna de contrato + 5 dias: ${cabecalhos.length}`);
ok(!cabecalhos.some((c) => /Sáb|Dom/.test(c)), 'sem sábado nem domingo');

console.log('-- periodicidade e última visita por contrato --');
ok(corpo.includes('QUINZENAL') && corpo.includes('2X NA SEMANA') && corpo.includes('MENSAL'), 'periodicidades exibidas');
ok(corpo.includes('sem visita realizada'), 'mostra que não há visita realizada');

console.log('\n===== FERIADOS =====');
ok(corpo.includes('Feriado Nacional de Teste'), 'feriado nacional no cabeçalho de quarta');
ok(corpo.includes('Aniversário do Rio'), 'feriado municipal no cabeçalho de quinta');

const celula = (contrato, dia) =>
  page.locator('tbody tr', { hasText: contrato }).locator('td button').nth(dia); // 0=seg .. 4=sex

console.log('-- nacional bloqueia todos os contratos na quarta --');
for (const c of ['Condomínio Solar das Flores', 'Edifício Atlântico', 'Clínica Vida Plena']) {
  ok(await celula(c, 2).isDisabled(), `${c}: quarta bloqueada`);
  ok((await celula(c, 2).innerText()).trim() === 'F', `${c}: quarta marcada com F`);
}

console.log('-- municipal do Rio bloqueia só os contratos do Rio na quinta --');
ok(await celula('Condomínio Solar das Flores', 3).isDisabled(), 'contrato no Rio: quinta bloqueada');
ok(!(await celula('Edifício Atlântico', 3).isDisabled()), 'contrato em SP: quinta LIVRE');
ok(!(await celula('Clínica Vida Plena', 3).isDisabled()), 'contrato em Niterói: quinta LIVRE');

console.log('\n===== MARCAR E DESMARCAR =====');
await celula('Condomínio Solar das Flores', 0).click();
await espera(300);
ok((await celula('Condomínio Solar das Flores', 0).innerText()).trim() === 'P', 'clique marca com P');
await celula('Condomínio Solar das Flores', 0).click();
await espera(300);
ok((await celula('Condomínio Solar das Flores', 0).innerText()).trim() === '', 'clique de novo desmarca');

console.log('-- contagem por dia no rodapé --');
await celula('Condomínio Solar das Flores', 0).click();
await celula('Colégio Monte Verde', 0).click();
await celula('Centro Logístico Norte', 1).click();
await espera(400);
const rodape = await page.locator('tfoot tr td').allInnerTexts();
ok(rodape[1].trim() === '2', `segunda com 2 visitas: ${rodape[1].trim()}`);
ok(rodape[2].trim() === '1', `terça com 1 visita: ${rodape[2].trim()}`);
ok(rodape[0].includes('3 visitas'), `total na semana: ${rodape[0].trim()}`);

console.log('\n===== SALVAR RASCUNHO =====');
await page.click('button:has-text("Salvar rascunho")');
await espera(3000);
ok(sql("select count(*) from visitas") === '3', `3 visitas gravadas: ${sql("select count(*) from visitas")}`);
ok(sql("select status from programacoes") === 'rascunho', 'programação em rascunho');
ok(sql("select count(*) from visitas where status='prevista' and origem='programada'") === '3', 'todas previstas e programadas');
ok(sql("select count(distinct programacao_id) from visitas") === '1', 'todas ligadas à mesma programação');

console.log('-- rascunho persiste ao recarregar --');
await page.reload({ waitUntil: 'networkidle' });
await espera(1200);
ok((await celula('Condomínio Solar das Flores', 0).innerText()).trim() === 'P', 'marcação voltou da base');

console.log('\n===== AVISOS DE PERIODICIDADE =====');
await page.click('button:has-text("Enviar programação")');
await espera(3500);
const comAviso = await page.locator('body').innerText();
// Conta os itens da lista de avisos, e não travessões soltos no texto.
const avisosNaTela = await page.locator('[role=alert] li').count();
ok(comAviso.includes('fora da periodicidade'), 'lista de avisos apareceu antes do envio');
ok(comAviso.includes('Clínica Vida Plena'), 'QUINZENAL sem visita avisado');
ok(comAviso.includes('Colégio Monte Verde'), '2X NA SEMANA com só 1 avisado');
ok(!comAviso.includes('Condomínio Solar das Flores —'), 'SEMANAL com 1 visita não avisado');
ok(sql("select status from programacoes") === 'rascunho', 'NÃO enviou: aguarda confirmação');
ok(comAviso.includes('Enviar assim mesmo'), 'botão "Enviar assim mesmo" oferecido');

/*
 * 28/09 a 02/10 é a última semana de setembro — o mês da semana é o da
 * segunda-feira. Então o contrato MENSAL sem visita no mês PRECISA avisar:
 * é a última chance de cumprir a periodicidade.
 */
console.log('-- MENSAL avisa na última semana do mês --');
ok(/Edifício Atlântico/.test(comAviso), 'Edifício Atlântico (MENSAL) avisado na última semana do mês');

console.log('\n===== ENVIAR ASSIM MESMO =====');
await page.click('button:has-text("Enviar assim mesmo")');
await espera(3500);
ok(sql("select status from programacoes") === 'enviada', 'programação enviada');
ok(sql("select enviada_em is not null from programacoes") === 't', 'enviada_em preenchida');

console.log('-- a decisão de enviar com avisos ficou registrada --');
const registrados = sql("select jsonb_array_length(avisos_no_envio) from programacoes");
ok(avisosNaTela > 0 && registrados === String(avisosNaTela),
   `avisos_no_envio guardou os mesmos ${avisosNaTela} avisos que estavam na tela: ${registrados}`);
ok(sql("select avisos_no_envio->0->>'contratoNome' from programacoes").length > 0, 'registro tem o nome do contrato');

console.log('\n===== ENVIADA NÃO SE EDITA =====');
await page.reload({ waitUntil: 'networkidle' });
await espera(1500);
const depois = await page.locator('body').innerText();
ok(depois.includes('não pode mais ser editada'), 'tela avisa que está travada');
ok(depois.includes('fora da periodicidade'), 'mostra com quantos avisos foi enviada');
ok(await celula('Centro Logístico Norte', 4).isDisabled(), 'células desabilitadas');
ok(!depois.includes('Salvar rascunho'), 'botão de salvar sumiu');
ok(!depois.includes('Reabrir para edição'), 'supervisor NÃO vê o botão de reabrir');

await page.screenshot({ path: raiz('telas/30-programacao-enviada.png'), fullPage: true });
await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
