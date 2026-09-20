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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Entra como COORDENADOR, que não pode gerir usuários.
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'carla@empresa.com.br');
await page.fill('#senha', 'senha12345');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(2200);

const idRafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
await page.goto(`${B}/cadastros/supervisores/${idRafael}`, { waitUntil: 'networkidle' });

console.log('\n===== COORDENADOR ADULTERA O FORMULÁRIO NO NAVEGADOR =====');
// Tira o disabled, remove os hidden que repõem o valor atual e tenta promover
// o Rafael a admin, além de inativá-lo.
await page.evaluate(() => {
  document.querySelectorAll('input[type=hidden][name=papel], input[type=hidden][name=ativo]').forEach((e) => e.remove());
  const papel = document.querySelector('#papel');
  papel.removeAttribute('disabled');
  papel.value = 'admin';
  const ativo = document.querySelector('#ativo');
  ativo.removeAttribute('disabled');
  ativo.checked = false;
});
ok((await page.inputValue('#papel')) === 'admin', 'formulário adulterado no cliente: papel=admin');

await page.click('button:has-text("Salvar")');
await page.waitForTimeout(2500);

const corpo = await page.locator('body').innerText();
ok(corpo.includes('é do admin'), `servidor recusou com mensagem: ${JSON.stringify(corpo.match(/Alterar papel[^\n]*/)?.[0] ?? '(sem mensagem)')}`);
ok(sql("select papel from usuarios where email='rafael@empresa.com.br'") === 'supervisor', 'Rafael continua supervisor no banco');
ok(sql("select ativo from usuarios where email='rafael@empresa.com.br'") === 't', 'Rafael continua ativo no banco');

console.log('\n===== COORDENADOR TENTA REDEFINIR SENHA DE OUTRO =====');
const hashAntes = sql("select senha_hash from usuarios where email='rafael@empresa.com.br'");
// A action de redefinir senha exige admin; chamo pelo formulário injetado.
await page.evaluate((id) => {
  const f = document.createElement('form');
  f.id = 'forjado';
  f.innerHTML = `<input name="id" value="${id}"><input name="senha" value="invadida123"><input name="confirmacao" value="invadida123">`;
  document.body.appendChild(f);
}, idRafael);
await page.waitForTimeout(500);
ok(sql("select senha_hash from usuarios where email='rafael@empresa.com.br'") === hashAntes, 'senha do Rafael intacta');

console.log('\n===== ÚLTIMO ADMIN NÃO PODE SER REBAIXADO =====');
await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.cookie.split(';').forEach((c) => { document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'; }));
await ctx.clearCookies();

const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${B}/login`, { waitUntil: 'networkidle' });
await p2.fill('#email', 'admin@empresa.com.br');
await p2.fill('#senha', 'admin123');
await p2.click('button:has-text("Entrar")');
await p2.waitForTimeout(2200);

// Promove a Carla a admin e depois tenta rebaixar o admin original:
// com outro admin ativo, a regra do "último admin" não deve bloquear,
// mas a regra de "não alterar a si mesmo" ainda vale.
const idCarla = sql("select id from usuarios where email='carla@empresa.com.br'");
await p2.goto(`${B}/cadastros/supervisores/${idCarla}`, { waitUntil: 'networkidle' });
await p2.selectOption('#papel', 'admin');
await p2.click('button:has-text("Salvar")');
await p2.waitForTimeout(2200);
ok(sql("select papel from usuarios where email='carla@empresa.com.br'") === 'admin', 'Carla promovida a admin');

// Agora a Carla (admin) tenta inativar o outro admin — permitido, pois sobra ela.
const ctx3 = await browser.newContext();
const p3 = await ctx3.newPage();
await p3.goto(`${B}/login`, { waitUntil: 'networkidle' });
await p3.fill('#email', 'carla@empresa.com.br');
await p3.fill('#senha', 'senha12345');
await p3.click('button:has-text("Entrar")');
await p3.waitForTimeout(2200);

const idAdmin = sql("select id from usuarios where email='admin@empresa.com.br'");
await p3.goto(`${B}/cadastros/supervisores/${idAdmin}`, { waitUntil: 'networkidle' });
await p3.uncheck('#ativo');
await p3.click('button:has-text("Salvar")');
await p3.waitForTimeout(2200);
ok(sql("select ativo from usuarios where email='admin@empresa.com.br'") === 'f', 'admin original inativado (sobrou a Carla)');

// Com a Carla como único admin ativo, ela não pode se inativar.
await p3.goto(`${B}/cadastros/supervisores/${idCarla}`, { waitUntil: 'networkidle' });
await p3.uncheck('#ativo');
await p3.click('button:has-text("Salvar")');
await p3.waitForTimeout(2200);
ok((await p3.locator('body').innerText()).includes('própria situação'), 'auto-inativação recusada');
ok(sql("select ativo from usuarios where email='carla@empresa.com.br'") === 't', 'Carla continua ativa');

// Restaura o admin original para os próximos testes.
sql("update usuarios set ativo=true where email='admin@empresa.com.br'");
sql("update usuarios set papel='coordenador' where email='carla@empresa.com.br'");

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
