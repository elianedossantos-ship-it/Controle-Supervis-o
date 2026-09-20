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

exec("delete from visitas; delete from programacoes;");

const SEMANA = '2026-09-28'; // a janela da sexta já fechou para as semanas anteriores
const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();

await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2500);

const supervisorId = sql("select id from usuarios where email='aline@empresa.com.br'");
const idRafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
const noRio = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const emSP = sql("select id from contratos where nome='Edifício Atlântico'");
const doRafael = sql("select id from contratos where nome='Banco Central Filial RJ'");

const LEGITIMA = `${noRio}|2026-09-29`;

// Reescreve o corpo do POST da server action em trânsito: é exatamente o que
// um cliente adulterado enviaria, sem depender do DOM que o React controla.
let troca = null;
await page.route('**/programacao*', async (rota) => {
  const req = rota.request();
  if (req.method() !== 'POST' || !troca) return rota.continue();
  let corpo = req.postData();
  if (corpo && corpo.includes(LEGITIMA)) {
    corpo = corpo.split(LEGITIMA).join(troca);
    return rota.continue({ postData: corpo });
  }
  return rota.continue();
});

async function tentar(celulaAdulterada) {
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Marca a célula legítima pela interface
  await page.locator('tbody tr', { hasText: 'Condomínio Solar das Flores' })
    .locator('td button').nth(1).click();
  await page.waitForTimeout(300);

  const antes = sql("select count(*) from visitas");
  troca = celulaAdulterada;
  await page.click('button:has-text("Salvar rascunho")');
  await page.waitForTimeout(3000);
  troca = null;

  const depois = sql("select count(*) from visitas");
  const corpo = await page.locator('body').innerText();
  const erro = corpo.match(/(Há visita marcada em dia de feriado|Só é possível programar de segunda a sexta|Há contrato fora da carteira|Você só pode montar|já foi enviada)[^\n.]*/)?.[0] ?? null;
  return { antes, depois, erro };
}

console.log('\n===== A INTERCEPTAÇÃO FUNCIONA (controle) =====');
{
  exec("delete from visitas; delete from programacoes;");
  const r = await tentar(LEGITIMA); // sem adulterar
  ok(r.depois === '1', `célula legítima gravada: ${r.depois} visita`);
  ok(r.erro === null, 'sem erro');
}

console.log('\n===== CÉLULAS ADULTERADAS SÃO RECUSADAS NO SERVIDOR =====');
for (const [rotulo, celula, esperado] of [
  ['feriado nacional (quarta)',        `${noRio}|2026-09-30`, 'feriado'],
  ['feriado municipal do Rio (quinta)',`${noRio}|2026-10-01`, 'feriado'],
  ['sábado',                           `${noRio}|2026-10-03`, 'segunda a sexta'],
  ['domingo',                          `${noRio}|2026-10-04`, 'segunda a sexta'],
  ['dia de outra semana',              `${noRio}|2026-10-12`, 'segunda a sexta'],
  ['contrato de outra carteira',       `${doRafael}|2026-09-29`, 'fora da carteira'],
]) {
  exec("delete from visitas; delete from programacoes;");
  const r = await tentar(celula);
  ok(r.depois === '0' && r.erro?.includes(esperado),
    `${rotulo}: recusado — ${JSON.stringify(r.erro)}`);
}

console.log('\n===== FERIADO MUNICIPAL DO RIO NÃO ALCANÇA CONTRATO DE SP =====');
{
  exec("delete from visitas; delete from programacoes;");
  const r = await tentar(`${emSP}|2026-10-01`);
  ok(r.depois === '1' && r.erro === null, `contrato de SP aceito na quinta: ${r.depois} visita, erro=${r.erro}`);
}

console.log('\n===== SUPERVISOR NÃO GRAVA NA CARTEIRA DE OUTRO =====');
{
  exec("delete from visitas; delete from programacoes;");
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('tbody tr', { hasText: 'Condomínio Solar das Flores' }).locator('td button').nth(1).click();
  await page.waitForTimeout(300);

  await page.route('**/programacao*', async (rota) => {
    const req = rota.request();
    if (req.method() !== 'POST') return rota.continue();
    let corpo = req.postData();
    if (corpo && corpo.includes(supervisorId)) {
      return rota.continue({ postData: corpo.split(supervisorId).join(idRafael) });
    }
    return rota.continue();
  });

  await page.click('button:has-text("Salvar rascunho")');
  await page.waitForTimeout(3000);
  const corpo = await page.locator('body').innerText();
  ok(sql(`select count(*) from visitas where supervisor_id='${idRafael}'`) === '0', 'nada gravado na carteira do Rafael');
  ok(corpo.includes('só pode montar a própria'), `mensagem: ${JSON.stringify(corpo.match(/Você só pode[^\n]*/)?.[0] ?? '')}`);
}

console.log('\n===== PROGRAMAÇÃO ENVIADA RECUSA GRAVAÇÃO =====');
{
  exec("delete from visitas; delete from programacoes;");
  exec(`insert into programacoes (supervisor_id, semana_inicio, semana_fim, status, enviada_em)
        values ('${supervisorId}', '2026-09-28', '2026-10-02', 'enviada', now())`);
  await page.unroute('**/programacao*');
  await page.goto(`${B}/programacao?semana=${SEMANA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('não pode mais ser editada'), 'tela mostra travada');
  ok(!corpo.includes('Salvar rascunho'), 'sem botão de salvar na tela');
  ok(sql("select count(*) from visitas") === '0', 'nenhuma visita gravada');
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
