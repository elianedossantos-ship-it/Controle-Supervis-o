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

const SEMANA = '2026-09-28'; // a mesma que a suíte programacao deixa enviada
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function entrar(email) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const celula = (page, contrato, dia) =>
  page.locator('tbody tr', { hasText: contrato }).locator('td button').nth(dia);

console.log('\n===== PROGRAMAÇÃO ENVIADA NÃO ACEITA GRAVAÇÃO, NEM ADULTERADA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const statusDaSemana = () => sql(`select status from programacoes where semana_inicio='${SEMANA}'`);
  ok(statusDaSemana() === 'enviada', 'a semana está enviada');
  const antes = sql("select count(*) from visitas");

  // Reinjeta o formulário com célula nova e botão de salvar, como se não estivesse travado.
  const supervisorId = sql("select id from usuarios where email='aline@empresa.com.br'");
  const contratoId = sql("select id from contratos where nome='Clínica Vida Plena'");
  await page.evaluate(({ supervisorId, contratoId, semana }) => {
    const f = document.createElement('form');
    f.method = 'post';
    f.innerHTML = `
      <input name="semanaInicio" value="${semana}">
      <input name="supervisorId" value="${supervisorId}">
      <input name="celula" value="${contratoId}|${semana}">
      <button type="submit" name="acao" value="rascunho" id="forjado">forjar</button>`;
    document.body.appendChild(f);
  }, { supervisorId, contratoId, semana: SEMANA });
  await page.waitForTimeout(500);
  ok(sql("select count(*) from visitas") === antes, 'nenhuma visita extra gravada pelo formulário injetado');
  ok(statusDaSemana() === 'enviada', 'continua enviada');
  await ctx.close();
}

console.log('\n===== COORDENAÇÃO REABRE; SUPERVISOR NÃO =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  const idAline = sql("select id from usuarios where email='aline@empresa.com.br'");
  await page.goto(`${B}/programacao?semana=${SEMANA}&supervisor=${idAline}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Reabrir para edição'), 'coordenador vê o botão de reabrir');
  ok(corpo.includes('Condomínio Solar das Flores'), 'coordenador vê a carteira da Aline');

  await page.click('button:has-text("Reabrir para edição")');
  await page.waitForTimeout(3000);
  ok(sql(`select status from programacoes where semana_inicio='${SEMANA}'`) === 'rascunho', 'voltou para rascunho');
  ok(sql(`select enviada_em is null from programacoes where semana_inicio='${SEMANA}'`) === 't', 'enviada_em limpa');
  await ctx.close();
}

console.log('\n===== SALVAR NÃO DESTRÓI VISITA REALIZADA, CANCELADA OU EXTRA =====');
{
  // Marca uma das previstas como realizada, outra como cancelada, e cria uma extra.
  exec("update visitas set status='realizada', realizada_em=now() where data_prevista='2026-09-28' and contrato_id=(select id from contratos where nome='Condomínio Solar das Flores')");
  exec("update visitas set status='cancelada' where data_prevista='2026-09-28' and contrato_id=(select id from contratos where nome='Colégio Monte Verde')");
  exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status)
        select c.id, u.id, '2026-09-29', 'extra', 'prevista'
        from contratos c, usuarios u where c.nome='Clínica Vida Plena' and u.email='aline@empresa.com.br'`);

  const realizadas = sql("select count(*) from visitas where status='realizada'");
  const canceladas = sql("select count(*) from visitas where status='cancelada'");
  const extras = sql("select count(*) from visitas where origem='extra'");
  ok(realizadas === '1' && canceladas === '1' && extras === '1', `preparado: ${realizadas} realizada, ${canceladas} cancelada, ${extras} extra`);

  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Muda a grade e salva de novo
  await celula(page, 'Centro Logístico Norte', 4).click();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Salvar rascunho")');
  await page.waitForTimeout(3000);

  ok(sql("select count(*) from visitas where status='realizada'") === '1', 'visita realizada preservada');
  ok(sql("select count(*) from visitas where status='cancelada'") === '1', 'visita cancelada preservada');
  ok(sql("select count(*) from visitas where origem='extra'") === '1', 'visita extra preservada');
  await ctx.close();
}

console.log('\n===== QUINZENAL COM VISITA RECENTE NÃO AVISA =====');
{
  // A Clínica Vida Plena (QUINZENAL) teve visita realizada? Vamos criar uma recente.
  exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status, realizada_em)
        select c.id, u.id, '2026-09-22', 'programada', 'realizada', now()
        from contratos c, usuarios u where c.nome='Clínica Vida Plena' and u.email='aline@empresa.com.br'`);

  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('última visita em 22/09/2026'), 'grade mostra a data da última visita realizada');
  ok(!corpo.match(/Clínica Vida Plena[^\n]*\n[^\n]*fora da periodicidade/), 'QUINZENAL visitado há 6 dias não é avisado');
  await ctx.close();
}

console.log('\n===== MENSAL AVISA NA ÚLTIMA SEMANA DO MÊS =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  // Semana de 28/09 a 02/10 é a última de setembro
  await page.goto(`${B}/programacao?semana=2026-09-28`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Enviar programação")');
  await page.waitForTimeout(3500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Edifício Atlântico'), 'MENSAL avisado na última semana do mês');
  ok(corpo.includes('setembro'), 'aviso nomeia o mês');
  await ctx.close();
}

console.log('\n===== SUPERVISOR NÃO MONTA A SEMANA DE OUTRO =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  const idRafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
  // Mesmo pedindo pela URL, deve cair na própria carteira.
  await page.goto(`${B}/programacao?semana=${SEMANA}&supervisor=${idRafael}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Aline Santos'), 'continua na própria programação');
  ok(!corpo.includes('Banco Central'), 'não vê contrato do Rafael');
  ok(!corpo.includes('Supermercado Bom Preço'), 'não vê o outro contrato do Rafael');

  const visitasRafaelAntes = sql(`select count(*) from visitas where supervisor_id='${idRafael}'`);
  const contratoRafael = sql("select id from contratos where nome='Banco Central Filial RJ'");
  // Formulário forjado apontando para o Rafael
  await page.evaluate(({ idRafael, contratoRafael, semana }) => {
    const f = document.createElement('form');
    f.innerHTML = `
      <input name="semanaInicio" value="${semana}">
      <input name="supervisorId" value="${idRafael}">
      <input name="celula" value="${contratoRafael}|${semana}">
      <button type="submit" name="acao" value="rascunho">forjar</button>`;
    document.body.appendChild(f);
  }, { idRafael, contratoRafael, semana: SEMANA });
  await page.waitForTimeout(800);
  ok(sql(`select count(*) from visitas where supervisor_id='${idRafael}'`) === visitasRafaelAntes, 'nenhuma visita criada na carteira do Rafael');
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
