import { chromium } from 'playwright';
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

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const espera = (ms = 2200) => page.waitForTimeout(ms);

async function entrar(email, senha) {
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', senha);
  await page.click('button:has-text("Entrar")');
  await espera();
}

await entrar('admin@empresa.com.br', 'admin123');

console.log('\n===== SUPERVISORES =====');
await page.goto(`${B}/cadastros/supervisores/novo`, { waitUntil: 'networkidle' });

console.log('-- senha curta deve ser recusada --');
await page.fill('#nome', 'Aline Santos');
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', '123');
await page.selectOption('#papel', 'supervisor');
await page.click('button:has-text("Salvar")');
await espera();
ok(page.url().includes('/novo'), 'continuou no formulário');
ok((await page.locator('body').innerText()).includes('ao menos 8 caracteres'), 'erro de senha exibido');
ok((await page.inputValue('#nome')) === 'Aline Santos', 'nome digitado foi preservado');
ok((await page.inputValue('#email')) === 'aline@empresa.com.br', 'e-mail digitado foi preservado');

console.log('-- criação válida --');
// Todas as contas de teste usam a mesma senha, para as demais suítes entrarem.
await page.fill('#senha', 'senha12345');
await page.fill('#telefone', '(21) 99999-0001');
await page.fill('#whatsapp', '(21) 99999-0001');
await page.click('button:has-text("Salvar")');
await espera();
ok(new URL(page.url()).pathname === '/cadastros/supervisores', `voltou para a lista: ${new URL(page.url()).pathname}`);
ok((await page.locator('body').innerText()).includes('Aline Santos'), 'aparece na lista');

console.log('-- e-mail duplicado deve ser recusado --');
await page.goto(`${B}/cadastros/supervisores/novo`, { waitUntil: 'networkidle' });
await page.fill('#nome', 'Outra Pessoa');
await page.fill('#email', 'aline@empresa.com.br');
await page.fill('#senha', 'outra12345');
await page.click('button:has-text("Salvar")');
await espera();
ok((await page.locator('body').innerText()).includes('Já existe usuário com este e-mail'), 'duplicata recusada');

console.log('-- mais dois supervisores + um coordenador --');
for (const [nome, email, papel] of [
  ['Rafael Silva', 'rafael@empresa.com.br', 'supervisor'],
  ['Sandra Vianna', 'sandra@empresa.com.br', 'supervisor'],
  ['Carla Coord', 'carla@empresa.com.br', 'coordenador'],
]) {
  await page.goto(`${B}/cadastros/supervisores/novo`, { waitUntil: 'networkidle' });
  await page.fill('#nome', nome);
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.selectOption('#papel', papel);
  await page.click('button:has-text("Salvar")');
  await espera();
}
const corpoLista = await page.locator('body').innerText();
ok(['Aline Santos', 'Rafael Silva', 'Sandra Vianna', 'Carla Coord'].every((n) => corpoLista.includes(n)), 'os 4 usuários aparecem na lista');

console.log('\n===== CONTRATOS =====');
await page.goto(`${B}/cadastros/contratos/novo`, { waitUntil: 'networkidle' });
await page.fill('#nome', 'Edifício Centro Empresarial');
await page.fill('#endereco', 'Av. Rio Branco, 100');
await page.fill('#bairro', 'Centro');
await page.fill('#cidade', 'Rio de Janeiro');
await page.selectOption('#uf', 'RJ');
await page.selectOption('#periodicidade', 'SEMANAL');
await page.fill('#escopo', 'limpeza, bombeiros, manutenção');
await page.fill('#observacoes', 'Inclui a manutenção. Brigada em outro andar.');
await page.fill('#contato_nome_0', 'Marcos Oliveira');
await page.fill('#contato_cargo_0', 'Síndico');
await page.fill('#contato_telefone_0', '(21) 98888-1234');
await page.fill('#contato_email_0', 'marcos@centro.com.br');
await page.check('#contato_principal_0');
await page.click('button:has-text("Adicionar contato")');
await page.fill('#contato_nome_1', 'Paula Ramos');
await page.fill('#contato_cargo_1', 'Zeladoria');
await page.click('button:has-text("Salvar")');
await espera();
ok(new URL(page.url()).pathname === '/cadastros/contratos', 'contrato salvo');

const corpoContratos = await page.locator('body').innerText();
ok(corpoContratos.includes('Edifício Centro Empresarial'), 'contrato na lista');
ok(corpoContratos.includes('SEMANAL'), 'periodicidade exibida');
ok(corpoContratos.includes('limpeza') && corpoContratos.includes('bombeiros'), 'escopo virou lista');

console.log('-- a UF é lista fechada; os contatos devem persistir --');
await page.click('a:has-text("Editar")');
await page.waitForTimeout(2000);
ok((await page.inputValue('#uf')) === 'RJ', `UF gravada como ${await page.inputValue('#uf')}`);
ok(await page.locator('#uf option').count() === 28, `27 UFs mais o vazio: ${await page.locator('#uf option').count()}`);
ok((await page.inputValue('#contato_nome_0')) !== '', 'contato 1 voltou preenchido');
ok((await page.inputValue('#contato_nome_1')) !== '', 'contato 2 voltou preenchido');
ok(await page.isChecked('#contato_principal_0'), 'contato principal preservado');

console.log('-- UF inexistente não passa nem forjada --');
await page.evaluate(() => {
  const s = document.querySelector('#uf');
  const o = document.createElement('option');
  o.value = 'XY';
  s.appendChild(o);
  s.value = 'XY';
});
await page.click('button:has-text("Salvar")');
await espera();
ok((await page.locator('body').innerText()).includes('UF'), 'UF inexistente recusada pelo servidor');
await page.goto(page.url().includes('/editar') ? page.url() : `${B}/cadastros/contratos`, { waitUntil: 'networkidle' });
await espera(1200);

console.log('-- mais dois contratos --');
for (const [nome, endereco, per] of [
  ['Hospital São Lucas', 'Rua das Palmeiras, 55', '2X NA SEMANA'],
  ['Shopping Norte', 'Av. Brasil, 9000', 'QUINZENAL'],
]) {
  await page.goto(`${B}/cadastros/contratos/novo`, { waitUntil: 'networkidle' });
  await page.fill('#nome', nome);
  await page.fill('#endereco', endereco);
  await page.selectOption('#periodicidade', per);
  await page.click('button:has-text("Salvar")');
  await espera();
}
ok((await page.locator('body').innerText()).includes('Hospital São Lucas'), '3 contratos cadastrados');

console.log('\n===== FERIADOS =====');
await page.goto(`${B}/cadastros/feriados`, { waitUntil: 'networkidle' });
console.log('-- estadual sem UF deve ser recusado --');
await page.fill('#data', '2026-04-23');
await page.fill('#descricao', 'São Jorge');
await page.selectOption('#abrangencia', 'estadual');
await page.click('button:has-text("Incluir feriado")');
await espera();
ok((await page.locator('body').innerText()).includes('estadual precisa de UF'), 'estadual sem UF recusado');

console.log('-- com UF passa --');
await page.selectOption('#uf', 'RJ');
await page.click('button:has-text("Incluir feriado")');
await espera();
let corpoFeriados = await page.locator('body').innerText();
ok(corpoFeriados.includes('São Jorge'), 'feriado estadual incluído');
ok(corpoFeriados.includes('23/04/2026'), 'data exibida em pt-BR sem deslocar o dia');

console.log('-- nacional --');
await page.fill('#data', '2026-09-07');
await page.fill('#descricao', 'Independência');
await page.selectOption('#abrangencia', 'nacional');
await page.selectOption('#uf', '');
await page.click('button:has-text("Incluir feriado")');
await espera();
corpoFeriados = await page.locator('body').innerText();
ok(corpoFeriados.includes('Independência') && corpoFeriados.includes('07/09/2026'), 'feriado nacional incluído');

console.log('-- excluir --');
await page.click('tr:has-text("São Jorge") button:has-text("Excluir")');
await espera();
ok(!(await page.locator('body').innerText()).includes('São Jorge'), 'feriado excluído');

await page.screenshot({ path: raiz('telas/10-feriados.png'), fullPage: true });
await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
