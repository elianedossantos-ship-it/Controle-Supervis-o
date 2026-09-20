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
const FOTO = raiz('fixtures/foto-teste.jpg');
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

exec("delete from evidencias; delete from plano_atualizacoes; delete from planos_acao; delete from visitas;");
const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");

const browser = await chromium.launch({ executablePath: CHROMIUM });
async function entrar(email, mobile = false) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR',
          permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -43.1, accuracy: 10 } }
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

console.log('\n===== ABRIR PLANO, COM PRAZO SUGERIDO PELA PRIORIDADE =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Abrir plano de ação")');
  await page.waitForTimeout(800);

  const prazoNormal = await page.inputValue('#np-prazo');
  await page.selectOption('#np-prioridade', 'critica');
  await page.waitForTimeout(500);
  const prazoCritico = await page.inputValue('#np-prazo');
  ok(prazoCritico < prazoNormal, `crítica sugere prazo mais curto (${prazoCritico} < ${prazoNormal})`);
  ok((await page.locator('body').innerText()).includes('48 horas'), 'a tela explica a sugestão');

  await page.selectOption('#np-prioridade', 'normal');
  await page.waitForTimeout(400);
  await page.selectOption('#np-contrato', solar);
  await page.fill('#np-descricao', 'Infiltração no teto da garagem.');
  await page.fill('#np-local', 'Garagem, vaga 12');
  await page.fill('#np-responsavel', 'Zeladoria');
  await page.locator('#np-foto').setInputFiles(FOTO);
  await page.click('button:has-text("Abrir plano")');
  await page.waitForTimeout(3500);

  ok(sql("select count(*) from planos_acao") === '1', 'plano criado');
  ok(sql("select status from planos_acao") === 'aberto', 'nasce aberto');
  ok(sql("select prioridade from planos_acao") === 'normal', 'prioridade gravada');
  ok(sql("select local_setor from planos_acao") === 'Garagem, vaga 12', 'local gravado');
  ok(sql("select count(*) from evidencias where plano_id is not null") === '1', 'foto ligada ao plano');
  ok(sql("select prazo is not null from planos_acao") === 't', 'prazo gravado');
  await ctx.close();
}

console.log('\n===== ACOMPANHAMENTO MOVE PARA "EM ANDAMENTO" =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Acompanhar")');
  await page.waitForTimeout(700);
  await page.locator('textarea[name=texto]').fill('Zeladoria abriu chamado com a construtora.');
  await page.locator('input[name=foto]').setInputFiles(FOTO);
  await page.click('button:has-text("Registrar acompanhamento")');
  await page.waitForTimeout(3500);

  ok(sql("select status from planos_acao") === 'em_andamento', 'status virou em andamento');
  ok(sql("select count(*) from plano_atualizacoes where tipo='acompanhamento'") === '1', 'acompanhamento registrado');
  ok(sql("select count(*) from evidencias where atualizacao_id is not null") === '1', 'foto ligada ao acompanhamento');

  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('Zeladoria abriu chamado'), 'o histórico aparece no cartão');
  ok(corpo.includes('Aline Santos'), 'com o autor');
  await ctx.close();
}

console.log('\n===== EDITAR GRAVA REGISTRO (HISTÓRICO SOMENTE-ACRÉSCIMO) =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Editar")');
  await page.waitForTimeout(700);
  await page.locator('textarea[name=descricao]').fill('Infiltração no teto da garagem, agora com mofo.');
  await page.locator('select[name=prioridade]').selectOption('alta');
  await page.click('button:has-text("Salvar alteração")');
  await page.waitForTimeout(3500);

  ok(sql("select prioridade from planos_acao") === 'alta', 'prioridade alterada');
  ok(sql("select descricao from planos_acao").includes('mofo'), 'descrição alterada');
  ok(sql("select count(*) from plano_atualizacoes where tipo='edicao'") === '1', 'edição virou registro no histórico');
  const textoEdicao = sql("select texto from plano_atualizacoes where tipo='edicao'");
  ok(textoEdicao.includes('prioridade'), `o registro diz o que mudou: ${textoEdicao}`);
  await ctx.close();
}

console.log('\n===== ALTA E CRÍTICA SÓ A COORDENAÇÃO ENCERRA (decisão 13.16) =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Resolver")');
  await page.waitForTimeout(700);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('encerrado pela coordenação'), 'a tela explica que o supervisor não encerra');
  ok(!(await page.locator('input[name=foto][required]').count()), 'o formulário de resolver nem aparece');
  ok(sql("select status from planos_acao") === 'em_andamento', 'nada mudou');
  await ctx.close();
}

console.log('\n-- e o servidor recusa, mesmo por requisição --');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Rebaixa a prioridade para conseguir abrir o formulário, e adultera de volta.
  const planoId = sql("select id from planos_acao");
  exec(`update planos_acao set prioridade='normal' where id='${planoId}'`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Resolver")');
  await page.waitForTimeout(700);
  await page.locator('input[name=foto]').setInputFiles(FOTO);
  exec(`update planos_acao set prioridade='critica' where id='${planoId}'`);
  await page.click('button:has-text("Marcar como resolvido")');
  await page.waitForTimeout(3500);
  ok(sql("select status from planos_acao") === 'em_andamento', 'servidor recusou: status intacto');
  ok((await page.locator('body').innerText()).includes('encerrado pela coordenação'), 'com a mensagem certa');
  exec(`update planos_acao set prioridade='normal' where id='${planoId}'`);
  await ctx.close();
}

console.log('\n===== RESOLVER EXIGE FOTO =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Resolver")');
  await page.waitForTimeout(700);
  ok((await page.locator('input[name=foto]').getAttribute('required')) !== null, 'o campo de foto é obrigatório');

  await page.locator('input[name=foto]').setInputFiles(FOTO);
  await page.locator('textarea[name=texto]').fill('Construtora refez a impermeabilização.');
  await page.click('button:has-text("Marcar como resolvido")');
  await page.waitForTimeout(3500);

  ok(sql("select status from planos_acao") === 'resolvido', 'plano resolvido');
  ok(sql("select resolvido_em is not null from planos_acao") === 't', 'carimbo de resolução');
  ok(sql("select count(*) from plano_atualizacoes where tipo='resolucao'") === '1', 'resolução no histórico');
  ok(sql("select count(*) from evidencias where atualizacao_id in (select id from plano_atualizacoes where tipo='resolucao')") === '1', 'foto da solução guardada');
  await ctx.close();
}

console.log('\n===== REABRIR É DA COORDENAÇÃO =====');
{
  const { ctx, page } = await entrar('aline@empresa.com.br');
  await page.goto(`${B}/planos?situacao=todos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  ok(!(await page.locator('body').innerText()).includes('Reabrir'), 'supervisor não vê o botão de reabrir');
  await ctx.close();
}
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/planos?situacao=todos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Reabrir")');
  await page.waitForTimeout(700);
  await page.locator('textarea[name=motivo]').fill('A infiltração voltou na primeira chuva.');
  await page.click('button:has-text("Reabrir plano")');
  await page.waitForTimeout(3500);
  ok(sql("select status from planos_acao") === 'em_andamento', 'plano reaberto');
  ok(sql("select resolvido_em is null from planos_acao") === 't', 'carimbo de resolução limpo');
  ok(sql("select count(*) from plano_atualizacoes where tipo='reabertura'") === '1', 'reabertura no histórico');
  await page.screenshot({ path: `${T}/19-planos.png`, fullPage: true });
  await ctx.close();
}

console.log('\n===== CANCELAR EXIGE JUSTIFICATIVA =====');
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await page.goto(`${B}/planos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Cancelar")');
  await page.waitForTimeout(700);
  ok((await page.locator('textarea[name=motivo]').getAttribute('required')) !== null, 'justificativa obrigatória');
  await page.locator('textarea[name=motivo]').fill('Duplicado do chamado 4412.');
  await page.click('button:has-text("Cancelar plano")');
  await page.waitForTimeout(3500);
  ok(sql("select status from planos_acao") === 'cancelado', 'plano cancelado');
  ok(sql("select motivo_cancelamento from planos_acao").includes('4412'), 'motivo gravado');
  await ctx.close();
}

console.log('\n===== O PLANO PERTENCE AO CONTRATO: REAPARECE NA VISITA =====');
{
  // Novo plano aberto e uma visita prevista no mesmo contrato
  exec(`insert into planos_acao (contrato_id, aberto_por, descricao, prioridade, status)
        values ('${solar}','${aline}','Lâmpada queimada na escada','normal','aberto')`);
  exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status)
        values ('${solar}','${aline}','2026-09-21','programada','prevista')`);

  const { ctx, page } = await entrar('aline@empresa.com.br', true);
  await page.goto(`${B}/meu-dia?dia=2026-09-21`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const corpo = await page.locator('body').innerText();
  ok(corpo.includes('1 plano aberto'), `selo de plano aberto no cartão da visita: ${corpo.match(/\d+ planos? abertos?/)?.[0]}`);
  ok(corpo.includes('Lâmpada queimada'), 'o plano aparece antes de qualquer ação');
  await page.screenshot({ path: `${T}/20-meu-dia-planos.png`, fullPage: true });

  console.log('-- e a pergunta vem logo depois de registrar --');
  await page.locator('button:has-text("Realizada")').first().click();
  await page.waitForTimeout(1600);
  await page.locator('input[type=file]').first().setInputFiles(FOTO);
  await page.waitForTimeout(600);
  await page.click('button:has-text("Confirmar visita")');
  await page.waitForTimeout(4000);
  ok((await page.locator('body').innerText()).includes('Precisa abrir plano de ação?'), 'a pergunta aparece após o registro');
  await ctx.close();
}

console.log('\n===== ISOLAMENTO POR CARTEIRA =====');
{
  const { ctx, page } = await entrar('rafael@empresa.com.br');
  await page.goto(`${B}/planos?situacao=todos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const corpo = await page.locator('body').innerText();
  ok(!corpo.includes('Lâmpada queimada'), 'não vê plano de contrato de outra carteira');
  ok(!corpo.includes('Infiltração'), 'nem o outro');
  await ctx.close();
}

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
