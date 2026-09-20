import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
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
/*
 * Onde o driver local grava. O servidor lê isso do .env, então a suíte lê do
 * mesmo lugar — senão ela procuraria a foto na pasta errada.
 */
function dirDoArmazenamento() {
  if (process.env.STORAGE_LOCAL_DIR) return resolve(process.env.STORAGE_LOCAL_DIR);
  const env = raiz('../.env');
  if (existsSync(env)) {
    const linha = readFileSync(env, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('STORAGE_LOCAL_DIR='));
    if (linha) return resolve(linha.slice('STORAGE_LOCAL_DIR='.length).trim().replace(/^["']|["']$/g, ''));
  }
  return raiz('../armazenamento');
}
const DIR = dirDoArmazenamento();
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

const browser = await chromium.launch({ executablePath: CHROMIUM });
// Celular, com GPS concedido numa posição conhecida.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true,
  permissions: ['geolocation'],
  geolocation: { latitude: -22.9068, longitude: -43.1729, accuracy: 12 },
  locale: 'pt-BR',
});
const page = await ctx.newPage();
const espera = (ms = 2600) => page.waitForTimeout(ms);

await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await espera();

console.log('\n===== O DIA =====');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await espera(1500);
let corpo = await page.locator('body').innerText();
ok(corpo.includes('3 visitas em aberto'), 'conta as visitas em aberto');
ok(corpo.includes('Condomínio Solar das Flores'), 'lista as visitas do dia');
ok(corpo.includes('Marcos Oliveira') && corpo.includes('Síndico'), 'mostra o contato principal');
ok(await page.locator('a[href*="google.com/maps"]').first().isVisible(), 'endereço tem link para o mapa');
ok(await page.locator('a[href^="tel:"]').first().isVisible(), 'telefone do contato é clicável');

console.log('\n===== REGISTRAR REALIZADA: FOTO + GPS + HORÁRIO DO SERVIDOR =====');
const cartao = (nome) => page.locator('article', { hasText: nome });
await cartao('Condomínio Solar das Flores').locator('button:has-text("Realizada")').click();
await espera(1500);

corpo = await page.locator('body').innerText();
ok(corpo.includes('Localização obtida'), `GPS capturado: ${JSON.stringify(corpo.match(/Localização obtida[^\n]*/)?.[0] ?? '')}`);

const entrada = page.locator('input[type=file]').first();
ok((await entrada.getAttribute('capture')) === 'environment', 'input pede a câmera traseira (capture=environment)');
ok((await entrada.getAttribute('accept')) === 'image/*', 'aceita só imagem');

console.log('-- sem foto, o servidor recusa --');
const antes = sql("select count(*) from evidencias");
await page.locator('button:has-text("Confirmar visita")').click();
await espera(2000);
ok(sql("select count(*) from evidencias") === antes, 'nada gravado sem foto');

console.log('-- com foto, registra --');
await entrada.setInputFiles(FOTO);
await espera(800);
ok(await page.locator('img[alt="Prévia da foto"]').first().isVisible(), 'prévia da foto aparece');
await page.fill('textarea[name=observacao]', 'Portaria em obra, acesso pelos fundos.');
await page.locator('button:has-text("Confirmar visita")').click();
await espera(3500);

const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
ok(sql(`select status from visitas where contrato_id='${solar}'`) === 'realizada', 'visita marcada como realizada');
ok(sql(`select realizada_em is not null from visitas where contrato_id='${solar}'`) === 't', 'realizada_em preenchida');
ok(sql(`select observacao from visitas where contrato_id='${solar}'`).includes('Portaria em obra'), 'observação gravada');
ok(sql("select count(*) from evidencias") === '1', 'uma evidência gravada');

const lat = sql("select latitude from evidencias limit 1");
const lon = sql("select longitude from evidencias limit 1");
const prec = sql("select precisao_m from evidencias limit 1");
ok(lat.startsWith('-22.906'), `latitude gravada: ${lat}`);
ok(lon.startsWith('-43.172'), `longitude gravada: ${lon}`);
ok(prec === '12.0', `precisão gravada: ${prec} m`);

console.log('-- o horário é do servidor, não do aparelho --');
const diff = sql("select abs(extract(epoch from (capturado_em - now())))::int from evidencias limit 1");
ok(Number(diff) < 60, `capturado_em veio do servidor (${diff}s de diferença de now())`);

console.log('-- a foto foi para o armazenamento --');
const url = sql("select arquivo_url from evidencias limit 1");
ok(url.startsWith('/api/evidencias/evidencias/'), `url da evidência: ${url}`);
const chave = url.replace('/api/evidencias/', '');
ok(existsSync(`${DIR}/${chave}`), `arquivo no disco: ${chave}`);

console.log('-- e é servida pela rota autenticada --');
const resp = await page.request.get(`${B}${url}`);
ok(resp.status() === 200, `GET da foto: ${resp.status()}`);
ok((resp.headers()['content-type'] ?? '').includes('image/jpeg'), 'content-type de imagem');
ok((resp.headers()['cache-control'] ?? '').includes('private'), 'cache privado');
ok((await resp.body()).length === 335, `bytes idênticos ao enviado: ${(await resp.body()).length}`);

console.log('\n===== CANCELAR COM MOTIVO =====');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await espera(1500);
await cartao('Colégio Monte Verde').locator('button:has-text("Cancelar")').click();
await espera(1200);

const opcoes = await page.locator('select[name=motivoId] option').allInnerTexts();
ok(opcoes.length === 13, `os 12 motivos da lista fechada + placeholder: ${opcoes.length}`);
ok(opcoes.some((o) => o.includes('Veículo em manutenção')), 'motivo 8 presente');
ok(opcoes.some((o) => o.trim() === 'Outro'), 'motivo 12 "Outro" presente');

console.log('-- "Outro" exige texto --');
await page.selectOption('select[name=motivoId]', { label: 'Outro' });
await espera(600);
ok(await page.locator('textarea[name=motivoOutro]').isVisible(), 'campo de texto aparece ao escolher "Outro"');
ok((await page.locator('textarea[name=motivoOutro]').getAttribute('required')) !== null, 'campo é obrigatório');

console.log('-- cancelar com motivo comum --');
await page.selectOption('select[name=motivoId]', { label: 'Veículo em manutenção' });
await espera(500);
ok(!(await page.locator('textarea[name=motivoOutro]').isVisible()), 'motivo comum não pede texto');
await page.locator('button:has-text("Confirmar cancelamento")').click();
await espera(3200);

const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");
ok(sql(`select status from visitas where contrato_id='${colegio}'`) === 'cancelada', 'visita cancelada');
ok(sql(`select m.descricao from visitas v join motivos_cancelamento m on m.id=v.motivo_id where v.contrato_id='${colegio}'`) === 'Veículo em manutenção', 'motivo gravado');
ok(sql(`select motivo_outro is null from visitas where contrato_id='${colegio}'`) === 't', 'motivo_outro vazio para motivo comum');

console.log('\n===== VISITA EXTRA =====');
await page.goto(`${B}/meu-dia?dia=${DIA}`, { waitUntil: 'networkidle' });
await espera(1500);
await page.locator('button:has-text("+ Visita extra")').click();
await espera(900);
await page.selectOption('select[name=contratoId]', { label: 'Edifício Atlântico' });
await page.fill('textarea[name=justificativa]', 'Cliente pediu vistoria emergencial no gerador.');
await page.locator('button:has-text("Lançar visita extra")').click();
await espera(3500);

ok(sql("select count(*) from visitas where origem='extra'") === '1', 'visita extra criada');
ok(sql("select status from visitas where origem='extra'") === 'prevista', 'entra como prevista');
ok(sql("select observacao from visitas where origem='extra'").includes('gerador'), 'justificativa gravada');

corpo = await page.locator('body').innerText();
ok(corpo.includes('Edifício Atlântico'), 'a extra aparece no dia');
ok(corpo.includes('Extra'), 'marcada como extra no cartão');

await page.screenshot({ path: raiz('telas/60-meu-dia.png'), fullPage: true });
await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
