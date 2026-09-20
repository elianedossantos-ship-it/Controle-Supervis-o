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

exec("delete from obrigacao_ocorrencias; delete from programacoes; delete from visitas; delete from evidencias; delete from feriados;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");

const browser = await chromium.launch({ executablePath: CHROMIUM });
async function entrar(email, mobile = false) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' }
      : { viewport: { width: 1360, height: 950 }, locale: 'pt-BR' },
  );
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  return { ctx, page };
}

console.log('\n===== GERAÇÃO DAS OCORRÊNCIAS =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // 3 supervisores ativos × (4 mensais + 1 diária + 4 semanais) = 3 × 9 = 27
  const total = sql("select count(*) from obrigacao_ocorrencias");
  ok(total === '27', `27 ocorrências geradas (3 supervisores × 9 competências): ${total}`);
  ok(sql("select count(*) from obrigacao_ocorrencias where competencia='2026-09-01'") === '15',
     '5 obrigações mensais/diárias × 3 supervisores');
  ok(sql("select count(distinct competencia) from obrigacao_ocorrencias") === '5',
     '1 competência mensal + 4 semanais');

  console.log('-- prazos calculados --');
  ok(sql("select prazo from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Entrega de folha de ponto' limit 1") === '2026-09-07',
     'folha de ponto vence no dia 7');
  ok(sql("select prazo from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Mapa de frequência atualizado' limit 1") === '2026-09-30',
     'mapa de frequência (diária consolidada) vence no fim do mês');
  ok(sql("select prazo from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Cronograma de visitas' and o.competencia='2026-09-07' limit 1") === '2026-09-11',
     'cronograma da semana de 07/09 vence na sexta 11/09');

  console.log('-- abrir de novo não duplica --');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  ok(sql("select count(*) from obrigacao_ocorrencias") === '27', 'continua com 27');

  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Entrega de folha de ponto'), 'grade lista as obrigações');
  ok(corpo.includes('Aline Santos') && corpo.includes('Rafael Silva'), 'supervisores nas colunas');
  ok(corpo.includes('22 dias úteis'), `mostra os dias úteis do mês: ${corpo.match(/\d+ dias úteis/)?.[0]}`);
  ok(corpo.includes('automática'), 'cronograma de visitas marcado como automático');
  await ctx.close();
}

console.log('\n===== CRONOGRAMA DE VISITAS É AUTOMÁTICO =====');
{
  // A Aline envia a programação da semana de 14/09 dentro do prazo (sexta 11/09)
  exec(`insert into programacoes (supervisor_id, semana_inicio, semana_fim, status, enviada_em)
        values ('${aline}','2026-09-14','2026-09-18','enviada','2026-09-10 15:00-03')`);
  // O Rafael envia a mesma semana, mas só no sábado
  exec(`insert into programacoes (supervisor_id, semana_inicio, semana_fim, status, enviada_em)
        values ('${rafael}','2026-09-14','2026-09-18','enviada','2026-09-12 09:00-03')`);

  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const statusDe = (sup) => sql(`select o.status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${sup}'`);
  ok(statusDe(aline) === 'atendido', `Aline enviou na quinta: atendido (${statusDe(aline)})`);
  ok(statusDe(rafael) === 'atendido_atraso', `Rafael enviou no sábado: atendido com atraso (${statusDe(rafael)})`);
  ok(sql(`select data_entrega from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`) === '2026-09-10',
     'data de entrega veio do envio da programação');
  ok(sql("select count(*) from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.marcado_por is not null") === '0',
     'nada marcado à mão: o status é do sistema');
  await ctx.close();
}

console.log('\n===== MARCAÇÃO PELA COORDENAÇÃO =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Abre a célula da folha de ponto da Aline
  const linha = page.locator('tbody tr', { hasText: 'Entrega de folha de ponto' });
  const coluna = (await page.locator('thead th').allInnerTexts()).indexOf('Aline Santos');
  await linha.locator('td').nth(coluna).locator('button').first().click();
  await page.waitForTimeout(900);

  let corpo = await page.locator('body').innerText();
  ok(corpo.includes('Entrega de folha de ponto') && corpo.includes('Aline Santos'), 'painel lateral abriu');
  ok(corpo.includes('Sem marcação manual'), 'histórico diz que ainda não houve marcação');

  await page.selectOption('#status', 'atendido_atraso');
  await page.fill('#dataEntrega', '2026-09-09');
  await page.fill('#observacao', 'Entregou dois dias depois, por atestado.');
  await page.click('button:has-text("Salvar marcação")');
  await page.waitForTimeout(3200);

  const marcada = `select o.status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Entrega de folha de ponto' and o.supervisor_id='${aline}'`;
  ok(sql(marcada) === 'atendido_atraso', `status gravado: ${sql(marcada)}`);
  ok(sql(`select data_entrega from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Entrega de folha de ponto' and o.supervisor_id='${aline}'`) === '2026-09-09',
     'data de entrega gravada');
  ok(sql(`select u.nome from obrigacao_ocorrencias o join usuarios u on u.id=o.marcado_por join obrigacoes b on b.id=o.obrigacao_id where b.nome='Entrega de folha de ponto' and o.supervisor_id='${aline}'`) === 'Carla Coord',
     'gravou quem marcou');
  ok(sql(`select marcado_em is not null from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Entrega de folha de ponto' and o.supervisor_id='${aline}'`) === 't',
     'gravou quando marcou');
  await ctx.close();
}

console.log('\n===== SOBRESCREVER O AUTOMÁTICO EXIGE JUSTIFICATIVA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const linha = page.locator('tbody tr', { hasText: 'Cronograma de visitas' });
  const coluna = (await page.locator('thead th').allInnerTexts()).indexOf('Aline Santos');
  await linha.locator('td').nth(coluna).locator('button').first().click();
  await page.waitForTimeout(900);
  ok((await page.locator('body').innerText()).includes('preenchida pelo sistema'), 'painel avisa que é automática');
  ok((await page.locator('#observacao').getAttribute('required')) !== null, 'justificativa é obrigatória no formulário');

  await page.selectOption('#status', 'nao_atendido');
  await page.waitForTimeout(300);

  // Sem justificativa, o navegador nem envia.
  const antes = sql(`select status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`);
  await page.click('button:has-text("Salvar marcação")');
  await page.waitForTimeout(2000);
  ok(sql(`select status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`) === antes,
     'nada gravado sem justificativa');
  ok((await page.inputValue('#status')) === 'nao_atendido',
     'a situação escolhida NÃO se perde na recusa');

  await page.fill('#observacao', 'Enviou fora do sistema, por e-mail, com a coordenação ciente.');
  await page.click('button:has-text("Salvar marcação")');
  await page.waitForTimeout(3200);
  const auto = `select o.status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`;
  ok(sql(auto) === 'nao_atendido', `com justificativa, a sobrescrita passa: ${sql(auto)}`);
  ok(sql(`select u.nome from obrigacao_ocorrencias o join usuarios u on u.id=o.marcado_por join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`) === 'Carla Coord',
     'a sobrescrita registra quem foi');

  console.log('-- e a sincronização não desfaz a marcação manual --');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  ok(sql(auto) === 'nao_atendido', 'marcação da coordenação tem precedência sobre o automático');
  await ctx.close();
}

console.log('\n===== O SERVIDOR TAMBÉM RECUSA, SE O FORMULÁRIO FOR ADULTERADO =====');
{
  exec("update obrigacao_ocorrencias set status='pendente', marcado_por=null, marcado_em=null, observacao=null");
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const linha = page.locator('tbody tr', { hasText: 'Cronograma de visitas' });
  const coluna = (await page.locator('thead th').allInnerTexts()).indexOf('Aline Santos');
  await linha.locator('td').nth(coluna).locator('button').first().click();
  await page.waitForTimeout(900);
  await page.selectOption('#status', 'nao_atendido');
  await page.fill('#observacao', 'JUSTIFICATIVA-QUE-SERA-REMOVIDA');
  await page.waitForTimeout(300);

  // Remove a justificativa em trânsito, como faria um cliente adulterado.
  await page.route('**/prazos*', async (rota) => {
    const req = rota.request();
    if (req.method() !== 'POST') return rota.continue();
    const corpo = req.postData();
    if (corpo && corpo.includes('JUSTIFICATIVA-QUE-SERA-REMOVIDA')) {
      return rota.continue({ postData: corpo.split('JUSTIFICATIVA-QUE-SERA-REMOVIDA').join('') });
    }
    return rota.continue();
  });

  const auto = `select o.status from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}'`;
  // Ao limpar as marcações, o sistema recalculou o automático: a Aline enviou
  // no prazo, então a situação correta antes da tentativa é "atendido".
  const antesDaTentativa = sql(auto);
  ok(antesDaTentativa === 'atendido', `situação automática antes da tentativa: ${antesDaTentativa}`);

  await page.click('button:has-text("Salvar marcação")');
  await page.waitForTimeout(3200);
  ok(sql(auto) === antesDaTentativa, `servidor recusou e nada mudou: ${sql(auto)}`);
  ok(sql(`select count(*) from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.automatica and o.competencia='2026-09-07' and o.supervisor_id='${aline}' and o.marcado_por is not null`) === '0',
     'nenhuma marcação manual foi registrada');
  ok((await page.locator('body').innerText()).includes('escreva a justificativa'), 'mensagem do servidor aparece');
  await ctx.close();
}

console.log('\n===== SUPERVISOR VÊ SÓ A PRÓPRIA COLUNA, EM LEITURA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const colunas = await page.locator('thead th').allInnerTexts();
  ok(colunas.length === 2, `1 coluna de obrigação + 1 supervisor: ${colunas.length}`);
  ok(colunas.includes('Aline Santos'), 'a própria coluna aparece');
  ok(!colunas.includes('Rafael Silva'), 'não vê a coluna do Rafael');

  const linha = page.locator('tbody tr', { hasText: 'Entrega de folha de ponto' });
  await linha.locator('td').nth(1).locator('button').first().click();
  await page.waitForTimeout(900);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Situação atual'), 'consegue abrir o painel e ler');
  ok(!corpo.includes('Salvar marcação'), 'não tem botão de salvar');
  await page.screenshot({ path: `${T}/17-prazos-supervisor.png`, fullPage: true });
  await ctx.close();
}

console.log('\n===== SUPERVISOR NÃO MARCA, NEM POR REQUISIÇÃO FORJADA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  const oc = sql(`select o.id from obrigacao_ocorrencias o join obrigacoes b on b.id=o.obrigacao_id where b.nome='Solicitação de material' and o.supervisor_id='${aline}'`);
  const antes = sql(`select status from obrigacao_ocorrencias where id='${oc}'`);
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  ok(sql(`select status from obrigacao_ocorrencias where id='${oc}'`) === antes, 'abrir a tela não muda nada');
  ok(antes === 'pendente', `ocorrência continua pendente: ${antes}`);
  await ctx.close();
}

console.log('\n===== CAPTURA DA GRADE =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/prazos?mes=2026-09`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${T}/16-prazos.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
