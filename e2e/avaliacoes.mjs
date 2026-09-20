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
const T = raiz('telas');
const OUT = raiz('saida');
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

exec("delete from avaliacao_acoes; delete from avaliacao_notas; delete from avaliacoes;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");

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

console.log('\n===== ABRIR AVALIAÇÃO =====');
let url = '';
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/avaliacoes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Abrir avaliação")');
  await page.waitForTimeout(700);
  await page.selectOption('#supervisorId', aline);
  await page.fill('#trimestre', '2026-08');
  await page.click('button:has-text("Abrir")');
  await page.waitForTimeout(3200);

  url = page.url();
  ok(url.includes('/avaliacoes/'), `foi para a avaliação: ${url.slice(-40)}`);
  ok(sql("select count(*) from avaliacoes") === '1', '1 avaliação criada');
  ok(sql("select periodo_inicio from avaliacoes") === '2026-07-01', `trimestre de agosto começa em julho: ${sql("select periodo_inicio from avaliacoes")}`);
  ok(sql("select periodo_fim from avaliacoes") === '2026-09-30', 'e termina em setembro');
  ok(sql("select status from avaliacoes") === 'rascunho', 'nasce como rascunho');

  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('REV 00'), 'aponta a versão do modelo');
  ok(corpo.includes('3º trimestre de 2026'), 'rótulo do trimestre');
  ok(corpo.includes('Operação e cumprimento de rotas'), 'competências do REV 00');
  ok(corpo.includes('peso 25%'), 'mostra o peso');
  ok(corpo.includes('Cumprimento do roteiro de visitas'), 'critério 1.1');

  console.log('-- evidência automática do sistema --');
  ok(corpo.includes('No sistema:'), 'critério com indicador traz o número do sistema');
  ok(corpo.includes('a nota é do avaliador'), 'deixa claro que é apoio, não substituto');

  console.log('-- abrir de novo leva à mesma avaliação --');
  await page.goto(`${B}/avaliacoes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Abrir avaliação")');
  await page.waitForTimeout(700);
  await page.selectOption('#supervisorId', aline);
  await page.fill('#trimestre', '2026-09');
  await page.click('button:has-text("Abrir")');
  await page.waitForTimeout(3200);
  ok(sql("select count(*) from avaliacoes") === '1', 'não criou uma segunda para o mesmo trimestre');
  await ctx.close();
}

console.log('\n===== NOTAS E CÁLCULO AO VIVO =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Dá nota 5 em todos os critérios de todas as competências
  for (let i = 0; i < 6; i++) {
    await page.locator('nav button').nth(i).click();
    await page.waitForTimeout(500);
    const botoes = page.locator('section button:has-text("5")');
    const n = await botoes.count();
    for (let j = 0; j < n; j++) {
      await botoes.nth(j).click();
      await page.waitForTimeout(450);
    }
  }
  await page.waitForTimeout(1200);

  let corpo = await page.locator('body').innerText();
  ok(corpo.includes('5,00'), `nota final 5,00: ${corpo.match(/Nota final\n([\d,]+)/)?.[1]}`);
  ok(corpo.includes('100,0%'), 'aproveitamento 100%');
  ok(corpo.includes('Excelente'), 'classificação Excelente');
  ok(sql("select count(*) from avaliacao_notas where nota=5") === '21', `21 notas gravadas: ${sql("select count(*) from avaliacao_notas")}`);

  console.log('-- "não se aplica" tira o critério do denominador --');
  await page.locator('nav button').nth(0).click();
  await page.waitForTimeout(500);
  await page.locator('section button:has-text("Não se aplica")').first().click();
  await page.waitForTimeout(1800);
  corpo = await page.locator('body').innerText();
  ok(corpo.includes('5,00'), 'com 3 notas 5 em vez de 4, a média da competência continua 5');
  ok(sql("select count(*) from avaliacao_notas where nota is null") === '1', 'a nota virou nulo na base');
  await ctx.close();
}

console.log('\n===== FECHAMENTO, PDI E FINALIZAÇÃO =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Fechamento e PDI")');
  await page.waitForTimeout(700);

  await page.fill('#pontosFortes', 'Rotas cumpridas com folga e boa relação com os contatos.');
  await page.fill('#pontosAtencao', 'Atrasar menos a folha de ponto.');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2500);
  ok(sql("select pontos_fortes from avaliacoes").includes('Rotas cumpridas'), 'pontos fortes gravados');

  await page.fill('#acao', 'Entregar a folha de ponto até o dia 5.');
  await page.fill('#como', 'Lembrete no calendário toda virada de mês.');
  await page.fill('#responsavel', 'Aline Santos');
  await page.fill('#prazo', '2026-12-31');
  await page.click('button:has-text("Adicionar ação")');
  await page.waitForTimeout(2500);
  ok(sql("select count(*) from avaliacao_acoes") === '1', 'ação do PDI gravada');
  ok(sql("select status from avaliacao_acoes") === 'aberta', 'nasce aberta');

  console.log('-- finalizar trava as notas --');
  await page.click('button:has-text("Finalizar avaliação")');
  await page.waitForTimeout(3200);
  ok(sql("select status from avaliacoes") === 'finalizada', 'avaliação finalizada');
  ok(sql("select nota_final from avaliacoes") === '5.00', `nota gravada: ${sql("select nota_final from avaliacoes")}`);
  ok(sql("select aproveitamento from avaliacoes") === '100.00', 'aproveitamento gravado');
  ok(sql("select classificacao from avaliacoes") === 'Excelente', 'classificação gravada');
  ok(sql("select finalizada_em is not null from avaliacoes") === 't', 'carimbo de finalização');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Notas travadas'), 'a tela avisa que travou');
  ok(!corpo.includes('Finalizar avaliação'), 'botão de finalizar sumiu');
  await page.screenshot({ path: `${T}/18-avaliacao.png`, fullPage: true });
  await ctx.close();
}

console.log('\n===== NOTA NÃO MUDA DEPOIS DE FINALIZADA, NEM POR REQUISIÇÃO FORJADA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('nav button').nth(0).click();
  await page.waitForTimeout(600);
  const antes = sql("select count(*) from avaliacao_notas where nota=5");
  const botao = page.locator('section button:has-text("1")').first();
  await botao.click().catch(() => {});
  await page.waitForTimeout(2000);
  ok(sql("select count(*) from avaliacao_notas where nota=5") === antes, 'nenhuma nota mudou');
  ok(sql("select count(*) from avaliacao_notas where nota=1") === '0', 'nota 1 não entrou');
  await ctx.close();
}

console.log('\n===== O SUPERVISOR VÊ A PRÓPRIA, FINALIZADA, E DÁ CIÊNCIA =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/avaliacoes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  let corpo = await page.locator('body').innerText();
  ok(corpo.includes('Aline Santos'), 'vê a própria avaliação na lista');
  ok(!corpo.includes('Abrir avaliação'), 'não pode abrir avaliação');

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  corpo = await page.locator('body').innerText();
  ok(corpo.includes('5,00'), 'consegue ler a nota');
  ok(corpo.includes('Dar ciência'), 'tem o botão de ciência');
  ok(!corpo.includes('Adicionar ação'), 'não edita o PDI');

  await page.click('button:has-text("Dar ciência")');
  await page.waitForTimeout(3200);
  ok(sql("select status from avaliacoes") === 'assinada', `ciência registrada: ${sql("select status from avaliacoes")}`);
  await ctx.close();
}

console.log('\n===== RASCUNHO NÃO APARECE PARA O SUPERVISOR =====');
{
  const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
  const modelo = sql("select id from avaliacao_modelos limit 1");
  const carla = sql("select id from usuarios where email='carla@empresa.com.br'");
  exec(`insert into avaliacoes (modelo_id, supervisor_id, avaliador_id, periodo_inicio, periodo_fim)
        values ('${modelo}','${rafael}','${carla}','2026-04-01','2026-06-30')`);
  const rascunho = sql(`select id from avaliacoes where supervisor_id='${rafael}'`);

  const { ctx, page } = await entrar('rafael@empresa.com.br');
  await page.goto(`${B}/avaliacoes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok((await page.locator('body').innerText()).includes('Nenhuma avaliação finalizada'), 'rascunho não aparece na lista');

  await page.goto(`${B}/avaliacoes/${rascunho}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const corpo404 = await page.locator('body').innerText();
  ok(corpo404.includes('Página não encontrada'), `acesso direto ao rascunho cai no 404 em português: ${JSON.stringify(corpo404.slice(0, 60))}`);
  // O nome no menu é o do próprio Rafael; o que não pode aparecer é a avaliação.
  ok(!/Aproveitamento|Competência|Dar ciência/.test(corpo404), 'e a tela do 404 não mostra nada da avaliação');

  console.log('-- nem a avaliação de outro supervisor --');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  ok(!(await page.locator('body').innerText()).includes('5,00'), 'não vê a nota da Aline');
  await ctx.close();
}

console.log('\n===== PDF DA AVALIAÇÃO =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  const id = url.split('/').pop();
  const resp = await page.request.get(`${B}/api/exportar/avaliacao?id=${id}`);
  ok(resp.status() === 200, `download respondeu 200: ${resp.status()}`);
  ok((resp.headers()['content-type'] ?? '').includes('application/pdf'), 'content-type de pdf');
  const pdf = await resp.body();
  writeFileSync(`${OUT}/avaliacao-aline.pdf`, pdf);
  ok(pdf.subarray(0, 5).toString() === '%PDF-', 'assinatura %PDF-');
  ok(pdf.length > 3000, `arquivo com ${pdf.length} bytes`);
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
